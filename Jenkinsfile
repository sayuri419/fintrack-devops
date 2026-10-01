// FinTrack API - Jenkins declarative pipeline
// Stages: Checkout -> Build -> Test -> Code Quality -> Security -> Deploy (staging)
//         -> Release (production) -> Monitoring & Alerting
pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '5'))
    timeout(time: 45, unit: 'MINUTES')
  }

  // Poll GitHub every 5 minutes (a webhook can't reach a laptop-hosted Jenkins).
  triggers { pollSCM('H/5 * * * *') }

  parameters {
    booleanParam(name: 'RELEASE_TO_PROD', defaultValue: true, description: 'Promote to production after staging passes')
    booleanParam(name: 'REQUIRE_APPROVAL', defaultValue: false, description: 'Pause for a manual approval before production')
    booleanParam(name: 'RUN_INCIDENT_DRILL', defaultValue: true, description: 'Inject faults in production and verify alerting')
    string(name: 'NOTIFY_EMAIL', defaultValue: 'you@example.com', description: 'Where build notifications are sent')
  }

  environment {
    REGISTRY       = 'localhost:5000'
    IMAGE_REPO     = "${REGISTRY}/fintrack-api"
    JWT_SECRET     = credentials('fintrack-jwt-secret')
    CHAOS_TOKEN    = credentials('fintrack-chaos-token')
    TRIVY_CACHE_DIR = '/var/jenkins_home/.trivy-cache'
    JEST_JUNIT_OUTPUT_DIR = 'reports'
    JEST_JUNIT_SUITE_NAME = '{displayName} - {filepath}'
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.APP_VERSION = sh(script: "node -p \"require('./package.json').version\"", returnStdout: true).trim()
          env.SHORT_SHA   = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.IMAGE_TAG   = "${env.APP_VERSION}-${env.BUILD_NUMBER}-${env.SHORT_SHA}"
          currentBuild.displayName = "#${env.BUILD_NUMBER} ${env.IMAGE_TAG}"
        }
        echo "Building ${IMAGE_REPO}:${IMAGE_TAG}"
      }
    }

    stage('Build') {
      steps {
        sh 'node --version && npm --version && docker --version'
        sh 'npm ci'
        sh 'APP_VERSION=$IMAGE_TAG GIT_COMMIT=$GIT_COMMIT npm run build'
        sh '''
          docker build \
            --build-arg APP_VERSION=$IMAGE_TAG \
            --build-arg GIT_COMMIT=$GIT_COMMIT \
            -t $IMAGE_REPO:$IMAGE_TAG .
          docker push $IMAGE_REPO:$IMAGE_TAG
          mkdir -p artifacts
          docker save $IMAGE_REPO:$IMAGE_TAG | gzip > artifacts/fintrack-api-$IMAGE_TAG.tar.gz
          docker image ls $IMAGE_REPO
        '''
      }
      post {
        success {
          archiveArtifacts artifacts: 'artifacts/*.tar.gz, build-info.json', fingerprint: true
        }
      }
    }

    stage('Test') {
      steps {
        sh 'mkdir -p reports'
        // Unit + integration suites with a coverage threshold enforced by Jest.
        sh 'npm run test:ci'
      }
      post {
        always {
          junit testResults: 'reports/junit.xml', allowEmptyResults: false
          recordCoverage(
            tools: [[parser: 'COBERTURA', pattern: 'coverage/cobertura-coverage.xml']],
            sourceCodeRetention: 'EVERY_BUILD',
            qualityGates: [
              [threshold: 85.0, metric: 'LINE',   baseline: 'PROJECT', criticality: 'FAILURE'],
              [threshold: 75.0, metric: 'BRANCH', baseline: 'PROJECT', criticality: 'UNSTABLE']
            ]
          )
        }
      }
    }

    stage('Code Quality') {
      steps {
        // ESLint enforces complexity/depth/params limits; the JSON report is imported into SonarQube.
        sh 'npm run lint'
        sh 'npm run lint:report'
        script {
          def scannerHome = tool 'SonarScanner'
          withSonarQubeEnv('SonarQube') {
            sh "${scannerHome}/bin/sonar-scanner -Dsonar.projectVersion=${IMAGE_TAG}"
          }
        }
        // Waits for SonarQube's webhook and stops the pipeline if the quality gate fails.
        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    stage('Security') {
      steps {
        sh 'mkdir -p reports'
        // 1) Dependency vulnerabilities (SCA) in production packages
        sh 'npm audit --omit=dev --json > reports/npm-audit.json || true'
        sh 'node scripts/audit-gate.js reports/npm-audit.json'
        // 2) Repository scan: vulnerable packages, hard-coded secrets, Dockerfile misconfigurations
        sh '''
          trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL \
            --skip-dirs node_modules --format table --output reports/trivy-fs.txt --exit-code 1 .
        '''
        // 3) Container image scan - full report archived, build blocked on fixable HIGH/CRITICAL
        sh '''
          trivy image --format json --output reports/trivy-image.json $IMAGE_REPO:$IMAGE_TAG
          trivy image --format table --output reports/trivy-image.txt $IMAGE_REPO:$IMAGE_TAG
          trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 $IMAGE_REPO:$IMAGE_TAG
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'reports/npm-audit.json, reports/trivy-*.txt, reports/trivy-image.json', allowEmptyArchive: true
        }
      }
    }

    stage('Deploy to Staging') {
      steps {
        // Compose-based deploy with readiness wait, smoke tests and automatic rollback.
        sh 'bash scripts/deploy.sh staging $IMAGE_TAG'
      }
    }

    stage('Release to Production') {
      when {
        expression { return params.RELEASE_TO_PROD && (env.GIT_BRANCH ?: 'main').endsWith('main') }
      }
      steps {
        script {
          if (params.REQUIRE_APPROVAL) {
            timeout(time: 15, unit: 'MINUTES') {
              input message: "Promote ${env.IMAGE_TAG} to production?", ok: 'Release'
            }
          }
        }
        // Promote the exact image that passed staging - no rebuild.
        sh '''
          docker tag $IMAGE_REPO:$IMAGE_TAG $IMAGE_REPO:$APP_VERSION
          docker tag $IMAGE_REPO:$IMAGE_TAG $IMAGE_REPO:stable
          docker push $IMAGE_REPO:$APP_VERSION
          docker push $IMAGE_REPO:stable
        '''
        sh 'bash scripts/deploy.sh prod $IMAGE_TAG'
        // Record the release in Git and produce release notes.
        sh '''
          PREV=$(git describe --tags --abbrev=0 2>/dev/null || true)
          {
            echo "# FinTrack API release v$APP_VERSION (build $BUILD_NUMBER)"
            echo "Image: $IMAGE_REPO:$IMAGE_TAG"
            echo "Commit: $GIT_COMMIT"
            echo
            echo "## Changes"
            if [ -n "$PREV" ]; then git log --oneline "$PREV"..HEAD; else git log --oneline -10; fi
          } > release-notes.md
          cat release-notes.md
        '''
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          withCredentials([gitUsernamePassword(credentialsId: 'github-creds', gitToolName: 'Default')]) {
            sh '''
              git config user.email "jenkins@fintrack.local"
              git config user.name "Jenkins CI"
              git tag -a "v$APP_VERSION-b$BUILD_NUMBER" -m "Release $IMAGE_TAG to production"
              git push origin "v$APP_VERSION-b$BUILD_NUMBER"
            '''
          }
        }
      }
      post {
        success { archiveArtifacts artifacts: 'release-notes.md', allowEmptyArchive: true }
      }
    }

    stage('Monitoring & Alerting') {
      when { expression { return params.RELEASE_TO_PROD } }
      steps {
        sh 'docker compose -f docker-compose.monitoring.yml up -d --build'
        sh 'bash scripts/monitoring-check.sh'
        script {
          if (params.RUN_INCIDENT_DRILL) {
            sh 'bash scripts/simulate-incident.sh'
          }
        }
      }
    }
  }

  post {
    success {
      echo "Pipeline succeeded: ${env.IMAGE_TAG} is live in production"
      emailext(
        to: params.NOTIFY_EMAIL,
        subject: "SUCCESS: FinTrack ${env.IMAGE_TAG} released (#${env.BUILD_NUMBER})",
        body: "All stages passed. Production: http://localhost:3000/health\nGrafana: http://localhost:3030\nBuild: ${env.BUILD_URL}"
      )
    }
    failure {
      emailext(
        to: params.NOTIFY_EMAIL,
        subject: "FAILED: FinTrack build #${env.BUILD_NUMBER}",
        body: "The pipeline failed. Console: ${env.BUILD_URL}console",
        attachLog: true
      )
    }
    always {
      archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
      sh 'docker image prune -f || true'
    }
  }
}

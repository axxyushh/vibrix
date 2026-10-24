pipeline {
  agent any
  tools { nodejs 'node20' }   // Manage Jenkins > Tools > NodeJS installations (name must match)
  options { timestamps(); timeout(time: 15, unit: 'MINUTES') }
  environment { NEXT_TELEMETRY_DISABLED = '1' }

  stages {
    stage('Install') {
      steps {
        sh 'node -v && npm -v'
        sh 'if [ -f package-lock.json ]; then npm ci; else npm install; fi'
      }
    }
    stage('Type check') {
      steps { sh 'npx tsc --noEmit' }
    }
    stage('Build') {
      steps { sh 'npm run build' }
    }
    stage('Smoke test') {
      steps {
        sh '''#!/bin/bash
          set -e
          npm run start -- -p 3100 > server.log 2>&1 &
          PID=$!
          trap "kill $PID" EXIT
          for i in $(seq 1 30); do curl -sf http://localhost:3100 >/dev/null && break; sleep 1; done
          curl -sf http://localhost:3100 | grep -q "Vibrix"
          test "$(curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3100/api/repo?url=bad')" = "400"
          test "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3100/api/test -H 'Content-Type: application/json' -d '{"url":"x"}')" = "403"
          echo "Smoke test passed"
        '''
      }
    }
  }
  post {
    always { archiveArtifacts artifacts: 'server.log', allowEmptyArchive: true }
  }
}

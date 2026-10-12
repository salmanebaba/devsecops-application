pipeline {
  agent { label 'trusted-local' }
  options { skipDefaultCheckout(true); disableConcurrentBuilds(); timestamps(); timeout(time: 40, unit: 'MINUTES'); buildDiscarder(logRotator(numToKeepStr: '10')) }
  environment { GHCR_OWNER = 'salmanebaba' }
  stages {
    stage('Checkout trusted local sources') {
      steps {
        deleteDir()
        sh '''set -eu
          mkdir -p source
          for repo in application infrastructure security-platform; do
            git clone --no-local "/ci/sources/$repo" "source/$repo"
          done
        '''
      }
    }
    stage('Tests, source, dependencies, build, SBOM, and image checks') {
      steps {
        script {
          int result = sh(returnStatus: true, script: '"$CI_TOOL_ROOT/checkov/bin/python" source/security-platform/ci/workflow.py application --source source --output evidence --tools "$CI_TOOL_ROOT"')
          env.SCANNER_WORKFLOW_EXIT = result.toString()
        }
      }
    }
    stage('OPA pre-staging decision') {
      steps {
        sh '"$CI_TOOL_ROOT/checkov/bin/python" source/security-platform/ci/gate.py evidence/evidence.json --opa "$CI_TOOL_ROOT/bin/opa" --policy source/security-platform/policies/pre_stage.rego'
      }
    }
    stage('Candidate ready for publishing configuration') {
      steps { echo 'Pre-staging checks passed. GHCR publishing and protected deployment require the account connection and later deployment workflow.' }
    }
  }
  post {
    always { archiveArtifacts artifacts: 'evidence/*.json,evidence/*.log,evidence/rendered/*.yaml', allowEmptyArchive: true, fingerprint: true }
  }
}

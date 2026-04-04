# --------------------------------------------------------------------------
# KMS — Envelope encryption for JWT signing secret
#
# Pattern: Cloud KMS encrypts a local data-encryption key (DEK).
# Pod calls kms.decrypt() once at startup; the plaintext key lives in memory
# only — never written to disk or logged.
#
# Key rotation: re-encrypt DEK with new KMS key version → update K8s secret
# → restart pods. The previous key version remains decryptable until disabled.
#
# Cost: ~$0.06/month (1 key + rare decrypt calls at pod restart)
# --------------------------------------------------------------------------

resource "google_kms_key_ring" "fenrir" {
  project  = var.project_id
  name     = "fenrir-keys"
  location = var.region

  depends_on = [google_project_service.apis]
}

resource "google_kms_crypto_key" "envelope" {
  name     = "fenrir-envelope"
  key_ring = google_kms_key_ring.fenrir.id

  # Automatic rotation every 90 days — new versions encrypt; old versions
  # still decrypt until explicitly disabled.
  rotation_period = "7776000s" # 90 days

  lifecycle {
    # Prevent accidental key destruction — re-enable manually if rotation needed
    prevent_destroy = true
  }
}

# --------------------------------------------------------------------------
# IAM — app workload SA: decrypt only (principle of least privilege)
# --------------------------------------------------------------------------

# App pods: decrypt ciphertext at startup (never encrypt)
resource "google_kms_crypto_key_iam_member" "app_kms_decrypt" {
  crypto_key_id = google_kms_crypto_key.envelope.id
  role          = "roles/cloudkms.cryptoKeyDecrypter"
  member        = "serviceAccount:${google_service_account.app_workload.email}"
}

# Deploy SA needs cloudkms.admin so it can encrypt new DEKs during secret rotation
resource "google_project_iam_member" "deploy_kms_admin" {
  project = var.project_id
  role    = "roles/cloudkms.admin"
  member  = "serviceAccount:${var.deploy_service_account}"
}

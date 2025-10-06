# Firestore Backup Setup Guide

## Overview
This guide explains how to set up automated daily backups for the Shot Builder application's Firestore database and Storage buckets to protect against data loss.

## Prerequisites
- Firebase Blaze (Pay as you go) plan
- gcloud CLI installed and authenticated
- Project admin access to `um-shotbuilder`

## 1. Firestore Automated Backups

### Option A: Using Firebase Console (Recommended for Initial Setup)

1. Go to [Firebase Console](https://console.firebase.google.com/project/um-shotbuilder/firestore)
2. Navigate to Firestore Database → Backups
3. Click "Set up backups"
4. Configure backup schedule:
   - **Frequency**: Daily
   - **Time**: 2:00 AM (UTC) - Low traffic period
   - **Retention**: 7 days (last 7 daily backups)
   - **Location**: `us-central1` (or your preferred region)
5. Click "Enable"

### Option B: Using gcloud CLI

```bash
# Set your project
gcloud config set project um-shotbuilder

# Create a daily backup schedule
gcloud firestore backups schedules create \
  --database="(default)" \
  --recurrence=daily \
  --retention=7d \
  --backup-time="02:00"

# Verify backup schedule
gcloud firestore backups schedules list
```

### Backup Locations
Backups are stored in Google Cloud Storage in the format:
```
gs://firestore-backups-um-shotbuilder/YYYY-MM-DD/
```

## 2. Manual Backup (On-Demand)

For critical operations (e.g., major migrations), create a manual backup:

```bash
# Create a one-time backup
gcloud firestore export gs://um-shotbuilder-backups/manual-$(date +%Y%m%d-%H%M%S) \
  --async

# Check export status
gcloud firestore operations list
```

## 3. Storage Bucket Versioning

Enable object versioning for Firebase Storage to protect against accidental deletions:

```bash
# Enable versioning on the storage bucket
gsutil versioning set on gs://um-shotbuilder.appspot.com

# Set lifecycle policy to delete old versions after 30 days
cat > lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "numNewerVersions": 3,
          "isLive": false
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://um-shotbuilder.appspot.com
```

## 4. Testing Backup Restoration

**IMPORTANT**: Test backup restoration in a separate test project first.

### Restore to Test Project

```bash
# Set test project
gcloud config set project um-shotbuilder-test

# List available backups
gcloud firestore backups schedules describe SCHEDULE_NAME

# Restore from backup
gcloud firestore import gs://firestore-backups-um-shotbuilder/YYYY-MM-DD/ \
  --async

# Monitor restore progress
gcloud firestore operations list
```

### Restore to Production (Emergency Only)

⚠️ **WARNING**: This will overwrite all current data. Only use in emergency situations.

```bash
# 1. Notify all users - take app offline
# 2. Create a snapshot of current state
gcloud firestore export gs://um-shotbuilder-backups/pre-restore-$(date +%Y%m%d-%H%M%S)

# 3. Restore from backup
gcloud firestore import gs://firestore-backups-um-shotbuilder/YYYY-MM-DD/

# 4. Verify data integrity
# 5. Bring app back online
```

## 5. Backup Monitoring

### Set Up Alerts

1. Go to [Cloud Console Monitoring](https://console.cloud.google.com/monitoring)
2. Create alert policy:
   - **Metric**: `firestore.googleapis.com/backup/success`
   - **Condition**: `success = false`
   - **Notification**: Email admin team

### Check Backup Status

```bash
# List recent backups
gsutil ls -l gs://firestore-backups-um-shotbuilder/

# View backup schedule status
gcloud firestore backups schedules list --format=json
```

## 6. Cost Estimates

- **Firestore Backups**: ~$0.10/GB/month storage + $0.50/GB export
- **Storage Versioning**: ~$0.026/GB/month for old versions
- **Estimated monthly cost**: $5-20 depending on data size

## 7. Backup Checklist

- [ ] Firestore daily backups enabled
- [ ] Storage bucket versioning enabled
- [ ] Backup schedule verified (run `gcloud firestore backups schedules list`)
- [ ] Test restoration performed in test environment
- [ ] Monitoring alerts configured
- [ ] Team notified of backup locations
- [ ] Documentation updated with recovery procedures

## 8. Recovery Time Objectives (RTO)

- **Manual backup creation**: 5-30 minutes (depending on data size)
- **Full database restore**: 1-4 hours
- **Storage object recovery**: 5-15 minutes

## 9. Backup Security

Backups inherit the same security as your GCS buckets:
- Only project admins can access backup buckets
- Enable audit logging for backup operations
- Use customer-managed encryption keys (CMEK) if required for compliance

```bash
# Enable audit logging
gcloud logging read "resource.type=gcs_bucket AND logName=projects/um-shotbuilder/logs/cloudaudit.googleapis.com%2Fdata_access"
```

## 10. Disaster Recovery Plan

### Scenario 1: Accidental Data Deletion
1. Identify deletion time (check Firestore console activity)
2. Stop all write operations to prevent further data loss
3. Restore from most recent backup BEFORE deletion
4. Manually re-enter data created after backup (if any)

### Scenario 2: Data Corruption
1. Identify corruption scope and timeline
2. Export current state for forensic analysis
3. Restore from clean backup
4. Implement validation to prevent recurrence

### Scenario 3: Complete Database Loss
1. Create new Firestore instance if needed
2. Restore from most recent daily backup
3. Verify data integrity with smoke tests
4. Update security rules and indexes
5. Bring application back online

## Next Steps

1. Run the setup commands in this document
2. Create a test restoration in a development environment
3. Schedule quarterly backup restoration drills
4. Document any custom recovery procedures specific to your app

## Support

For issues with backups:
- Firebase Support: https://firebase.google.com/support
- Firestore Backup Documentation: https://cloud.google.com/firestore/docs/backups

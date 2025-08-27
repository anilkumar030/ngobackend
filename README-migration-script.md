# Campaign Image Migration Script

A comprehensive Node.js script for migrating image files to campaign directories and updating campaign records in the database.

## Overview

This script provides a robust solution for migrating image files from any source directory to the structured campaign upload directory, while automatically updating the corresponding campaign record in the database with the new image URLs.

## Features

- **Multi-format Support**: Handles all common image formats (jpg, jpeg, png, webp, gif, bmp, tiff, svg)
- **Unique Naming**: Generates unique filenames using timestamps and UUIDs to prevent conflicts
- **Progress Tracking**: Real-time progress indicators during file processing
- **Transaction Safety**: Uses database transactions for atomic updates
- **Comprehensive Logging**: Detailed logging with timestamps and structured output
- **Error Handling**: Robust error handling with detailed error messages and rollback support
- **Validation**: Input validation for paths, campaign IDs, and file formats
- **URL Generation**: Automatically generates properly formatted image URLs
- **Duplicate Prevention**: Removes duplicate URLs when updating campaign images

## Requirements

- Node.js >= 16.0.0
- PostgreSQL database with Sequelize ORM
- Existing campaign record in the database
- Source directory with image files

## Installation

The script is ready to use - no additional installation required. All dependencies are already included in the project's package.json.

## Usage

### Basic Usage

```bash
node migrate-campaign-images.js <folder-path> <campaign-id>
```

### Parameters

1. **folder-path**: Absolute or relative path to the source directory containing image files
2. **campaign-id**: UUID of the campaign to update (must exist in the database)

### Examples

```bash
# Migrate images from a local directory
node migrate-campaign-images.js ./my-images 123e4567-e89b-12d3-a456-426614174000

# Migrate images from an absolute path
node migrate-campaign-images.js /home/user/campaign-photos 987fcdeb-51a2-43d1-b123-456789abcdef

# Migrate images from project subdirectories
node migrate-campaign-images.js ./bihar 02efb73f-a702-47cc-8928-515ae2d141af
```

## Script Workflow

1. **Input Validation**: Validates source path and campaign ID format
2. **Campaign Lookup**: Finds and validates the target campaign in the database
3. **Image Discovery**: Scans source directory for supported image files
4. **Directory Setup**: Creates unique destination folder in `/upload/campaigns/`
5. **File Processing**: Moves files with unique naming and progress tracking
6. **URL Generation**: Creates properly formatted URLs for each image
7. **Database Update**: Updates campaign record with new image URLs using transactions
8. **Cleanup**: Closes database connections and provides execution summary

## Directory Structure

### Before Migration
```
/source-directory/
├── image1.jpg
├── image2.png
├── image3.webp
└── other-file.txt (ignored)
```

### After Migration
```
/upload/campaigns/campaign-{id}-{timestamp}/
├── {timestamp}-{uuid}-image1.jpg
├── {timestamp}-{uuid}-image2.png
└── {timestamp}-{uuid}-image3.webp

/source-directory/
└── other-file.txt (non-images remain)
```

## URL Format

Generated URLs follow this format:
```
https://devapi.bdrf.in/upload/campaigns/{folder-name}/{unique-filename}
```

Example:
```
https://devapi.bdrf.in/upload/campaigns/campaign-02efb73f-2025-08-15T13-28-12-776Z/1755264492783-14222e6a-0adf-4973-af92-f6d3083d3f2b-uhc-1.webp
```

## Configuration

The script includes configurable constants in the `CONFIG` object:

```javascript
const CONFIG = {
  // Supported image formats
  SUPPORTED_FORMATS: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.svg'],
  
  // Upload directory
  UPLOAD_BASE_PATH: path.join(__dirname, 'upload', 'campaigns'),
  
  // API base URL (configurable via environment variable)
  API_BASE_URL: process.env.API_BASE_URL || 'https://devapi.bdrf.in',
  
  // Progress reporting frequency
  PROGRESS_INTERVAL: 5
};
```

## Environment Variables

- `API_BASE_URL`: Base URL for generating image URLs (default: https://devapi.bdrf.in)
- `NODE_ENV`: Environment mode (affects error detail display)

## Database Schema

The script updates the `images` field in the campaigns table:

```sql
-- Campaign images field structure
images JSONB DEFAULT '[]'

-- Example data after migration
images: [
  "https://devapi.bdrf.in/upload/campaigns/folder1/image1.jpg",
  "https://devapi.bdrf.in/upload/campaigns/folder1/image2.png"
]
```

## Error Handling

The script provides comprehensive error handling:

- **Input Validation Errors**: Invalid paths or campaign IDs
- **Database Errors**: Connection issues, transaction failures
- **File System Errors**: Permission issues, disk space, missing files
- **Campaign Errors**: Non-existent campaign, database constraint violations

All errors are logged with timestamps and detailed information.

## Testing

### Test the Script Setup

```bash
# Run the test script to validate configuration
node test-migration-script.js
```

### Verify Migration Results

```bash
# Verify migration results in database
node verify-migration-result.js
```

## Logging

The script provides detailed logging:

- **INFO**: General information and progress updates
- **SUCCESS**: Successful operations with details
- **WARNING**: Non-critical issues that don't stop execution
- **ERROR**: Critical errors with full details and suggestions

Example log output:
```
[2025-08-15T13:28:12.622Z] INFO: CAMPAIGN IMAGE MIGRATION STARTED
[2025-08-15T13:28:12.767Z] ✓ SUCCESS: Campaign found: My Campaign Title
[2025-08-15T13:28:12.774Z] ✓ SUCCESS: Found 10 image files
[2025-08-15T13:28:12.908Z] ✓ SUCCESS: CAMPAIGN IMAGE MIGRATION COMPLETED SUCCESSFULLY
```

## Security Features

- **Path Validation**: Prevents directory traversal attacks
- **UUID Validation**: Ensures proper campaign ID format
- **File Type Validation**: Only processes allowed image formats
- **Database Transactions**: Ensures data consistency
- **Error Sanitization**: Prevents sensitive information leakage

## Performance Considerations

- **Progress Reporting**: Configurable interval to balance feedback and performance
- **Transaction Usage**: Single transaction for database updates
- **File Size Verification**: Ensures complete file transfers
- **Memory Efficient**: Processes files sequentially to manage memory usage

## Troubleshooting

### Common Issues

1. **"Campaign not found"**
   - Verify the campaign ID exists in the database
   - Check UUID format

2. **"Source directory does not exist"**
   - Verify the path is correct and accessible
   - Check file permissions

3. **"Database connection failed"**
   - Verify database configuration
   - Check database server is running

4. **"Permission denied"**
   - Check file/directory permissions
   - Ensure write access to upload directory

### Debug Mode

For additional debugging information, set environment variables:

```bash
NODE_ENV=development node migrate-campaign-images.js /path/to/images campaign-id
```

## File Structure

```
migrate-campaign-images.js      # Main migration script
test-migration-script.js        # Testing and validation script
verify-migration-result.js      # Result verification script
README-migration-script.md      # This documentation
```

## API Integration

The generated URLs are compatible with the existing campaign API structure and can be used directly in:

- Campaign detail endpoints
- Image gallery displays
- Frontend applications
- Mobile app integrations

## Backup Recommendations

Before running the migration:

1. **Database Backup**: Create a backup of the campaigns table
2. **File Backup**: Backup source image files if they're originals
3. **Test Environment**: Test the migration in a development environment first

## License

This script is part of the Shiv Dhaam Foundation backend project and follows the same MIT license.

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Run the test script to validate your setup
3. Review the error logs for specific error messages
4. Ensure all requirements are met

---

**Note**: Always test the migration process in a development environment before using in production.
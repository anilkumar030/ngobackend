const express = require('express');
const certificateController = require('../controllers/certificateController');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  getUserCertificatesValidation,
  generateCertificateValidation,
  getCertificateByIdValidation,
  downloadCertificateValidation,
} = require('../validators/certificateValidators');

const router = express.Router();

// All certificate routes require authentication
router.use(authenticateToken);

router.get('/', validate(getUserCertificatesValidation), certificateController.getUserCertificates);
router.post('/generate', validate(generateCertificateValidation), certificateController.generateCertificate);
router.get('/:id', validate(getCertificateByIdValidation), certificateController.getCertificateById);
router.get('/:id/download', validate(downloadCertificateValidation), certificateController.downloadCertificate);

module.exports = router;
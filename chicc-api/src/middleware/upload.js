const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../public'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const username = req.body.username || 'unknown'; // ensure username is available in formData
    cb(null, `${username}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ storage, fileFilter });
module.exports = upload;

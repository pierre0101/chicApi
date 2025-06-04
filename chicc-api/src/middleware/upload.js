const multer = require('multer');
const path = require('path');

// Storage engine to save files in /public with original filenames
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../public')); // saving directly in 'public'
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // save with original filename
  }
});

// Restrict to image files only
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;

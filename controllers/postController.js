const multer = require('multer');
const sharp = require('sharp');
const Post = require('../models/postModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter
});

exports.uploadPostPhoto = upload.single('image');

exports.resizePostPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  req.file.filename = `post-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/posts/${req.file.filename}`);

  req.body.image = req.file.filename;

  next();
});

exports.getPost = factory.getOne(Post);
exports.getAllPosts = factory.getAll(Post);
exports.createPost = factory.createOne(Post);
exports.updatePost = factory.updateOne(Post);
exports.deletePost = factory.deleteOne(Post);

exports.likePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  //check if liked -> unlike
  if (post.likes.includes(req.user.id)) {
    await post.updateOne({ $pull: { likes: req.user.id } });
  } else {
    await post.updateOne({ $push: { likes: req.user.id } });
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getAllUserPosts = catchAsync(async (req, res, next) => {
  const posts = await Post.find({ user: req.params.userId });

  res.status(200).json({
    status: 'success',
    data: posts
  });
});

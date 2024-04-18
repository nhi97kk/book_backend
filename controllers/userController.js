const multer = require('multer');
const sharp = require('sharp');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
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

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  req.body = Object.assign({}, req.body);
  console.log(req.body);
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400
      )
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');
  if (req.file) filteredBody.photo = req.file.filename;

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined! Please use /signup instead.'
  });
};

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);
// do not update password with this
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);

//friend
exports.addFriend = catchAsync(async (req, res, next) => {
  const friendId = req.params.userId;
  const toUser = await User.findById(friendId);
  if (!toUser) {
    return next(new AppError('The user is not found.', 404));
  }
  //1 check if the users are already friend
  if (toUser.friends.includes(req.user.id)) {
    return next(new AppError('You and this user are already friends.', 400));
  }
  //2 check if had request
  if (toUser.requests.includes(req.user.id)) {
    return next(new AppError('You had request to this guy.', 400));
  }
  console.log(toUser.requests);
  console.log(req.user.id);
  //3 send request
  await toUser.updateOne({ $push: { requests: req.user.id } });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.acceptRequest = catchAsync(async (req, res, next) => {
  const friendId = req.params.userId;
  const toUser = await User.findById(friendId);

  if (!toUser) {
    return next(new AppError('The user is not found.', 404));
  }

  //check if have been already friend
  if (req.user.friends.includes(friendId)) {
    return next(new AppError('This user is your friend.', 400));
  }
  //check  if there is a request from that person
  if (!req.user.requests.includes(friendId)) {
    console.log(req.user.requests);
    console.log(friendId);
    return next(new AppError('This user is not send a request.', 400));
  }

  await req.user.updateOne({ $pull: { requests: friendId } });
  await req.user.updateOne({ $push: { friends: friendId } });
  await toUser.updateOne({ $push: { friends: req.user.id } });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.unFriend = catchAsync(async (req, res, next) => {
  const friendId = req.params.userId;
  const toUser = await User.findById(friendId);

  if (!toUser) {
    return next(new AppError('The user is not found.', 404));
  }

  //check  if there is a request from that person
  if (req.user.requests.includes(friendId)) {
    return next(new AppError('This user just send a request.', 400));
  }

  //check if have been already friend
  if (!req.user.friends.includes(friendId)) {
    return next(new AppError('This user is not your friend.', 400));
  }

  await req.user.updateOne({ $pull: { friends: friendId } });
  await toUser.updateOne({ $pull: { friends: req.user.id } });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.findAllFriends = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id)
    // Populate trường 'friends' và chỉ chọn các trường 'name' và 'photo'
    .populate({
      path: 'friends',
      select: 'name photo'
    })
    // Populate trường 'requests' và chỉ chọn các trường 'name' và 'photo'
    .populate({
      path: 'requests',
      select: 'name photo'
    });

  if (!user) return new AppError('User is not found!', 400);

  res.status(200).json({
    status: 'success',
    data: user
  });
});

exports.getOthers = catchAsync(async (req, res, next) => {
  // Tìm user hiện tại
  const currentUser = await User.findById(req.user.id);

  // Lấy danh sách bạn bè và yêu cầu của user hiện tại
  const friendIds = currentUser.friends;
  const requestIds = currentUser.requests;

  // Tìm tất cả các user không phải là bạn bè hoặc yêu cầu của user hiện tại
  const otherUsers = await User.aggregate([
    {
      $match: {
        _id: { $ne: currentUser._id },
        $nor: [{ _id: { $in: friendIds } }, { _id: { $in: requestIds } }]
      }
    },
    // Populate để lấy name và photo của các user
    {
      $project: {
        name: 1,
        photo: 1,
        requests: 1
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: otherUsers
  });
});

const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    desc: {
      type: String,
      required: true
    },
    image: String,
    likes: [],
    createdAt: {
      type: Date,
      default: Date.now()
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

postSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'user',
    select: '_id name photo'
  });
  next();
});

const Post = mongoose.model('Post', postSchema);

module.exports = Post;

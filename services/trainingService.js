const Training = require('../model/Training');
const mongoose = require('mongoose');

const updateSettings = async (req) => {
  try {
    const companyId = req.user;
    const moduleId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(moduleId)) {
      return { status: false, message: 'Invalid ID format' };
    }

    const module = await Training.findOne({ company_id: companyId, _id: moduleId });
    if (!module) {
      return { status: false, message: 'Invalid module' };
    }

    const { leaderboard_points } = req.body;

    if (!module.settings) module.settings = {};

    if (leaderboard_points !== undefined) {
      module.settings.leaderboard_points = leaderboard_points;
    }

    await module.save();

    return {
      status: true,
      message: 'Settings Saved',
      data:[]
    };
  } catch (error) {
    console.error('updateCardContent error:', error);
    return { status: false, message: 'Server error' };
  }
};


const getPaginatedTrainings = async (req, res) => {
  const companyId = req.user; // or req.query, depending on your setup
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const category = req.query.category;
  const keyword = req.query.keyword;
  
  const filter = { company_id: companyId };

  if (category && category != 'All' && mongoose.Types.ObjectId.isValid(category)) {
    filter.category_id = category;
  }

  
  if (keyword) {
    filter.$or = [
      { title: { $regex: keyword, $options: 'i' } },
      // { description: { $regex: keyword, $options: 'i' } }
    ];
  }

  try {
    const total = await Training.countDocuments(filter);
    const trainings = await Training.find(filter).populate('category_id', 'name')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ created_at: -1 }); // optional sorting

      return {
        status: true,
        message: 'Training fetched',
        data:{
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          data: trainings
        }
      };
  } catch (err) {
    console.log('get trainings error:', err);
    return { status: false, message: 'Server error' };
  }
};

const deleteTraining = async (req) => {
  try {
    const user = req.user;
    const moduleId = req.params.id;

    const module = await Training.findOne({ company_id: user._id, _id: moduleId });
    if (!module) {
      return {
        status: false,
        message: 'Training not found',
      };
    }

    await module.deleteOne();

    return {
      status: true,
      message: 'Training deleted successfully!',
    };
  } catch (err) {
    return {
      status: false,
      message: 'Failed to delete module',
      error: err.message
    };
  }
};

const updateStatus = async (req) => {
  try {
    const user = req.user;
    const moduleId = req.params.id;

    const module = await Training.findOne({ company_id: user._id, _id: moduleId });
    if (!module) {
      return {
        status: false,
        message: 'Training not found',
      };
    }

    const { status } = req.body;

    // Validate allowed statuses
    const allowedStatuses = ['draft', 'published'];
    if (!allowedStatuses.includes(status)) {
      return {
        status: false,
        message: 'Invalid status. Allowed values are "draft" or "published".',
      };
    }

    module.status = status;
    await module.save();

    return {
      status: true,
      message: `Training status updated to ${status}`,
    };
  } catch (err) {
    return {
      status: false,
      message: 'Failed to update module status',
      error: err.message,
    };
  }
};


module.exports = {
    updateSettings,
    getPaginatedTrainings,
    deleteTraining,
    updateStatus,
}
const bcrypt = require('bcryptjs')
const User = require('../../model/User')
const Country = require('../../model/Country')
const PackageType = require('../../model/PackageType')
const replaceTemplateField = require('../../util/ReplaceTemplateField')

const { errorResponse, successResponse } = require('../../util/response')
const { decrypt } = require('../../util/encryption')

const mongoose = require('mongoose')

exports.getCompanyIndexAPI = async (req, res, next) => {
  const userId = req.userId
  const company = await User.find({
    created_by: userId
  })
    .populate({
      path: 'reporting_manager_id',
      select: '_id first_name last_name'
    })
    .select(
      '_id first_name last_name email phone city_id state_id country_id address pincode employee_type  reporting_manager_id emp_id status codes '
    )

  res.status(200).json({
    status: 'Success',
    statusCode: 200,
    message: 'Data successfully fetched!',
    data: {
      company
    }
  })
}

exports.createCompanyAPI = async (req, res, next) => {
  const country = await Country.find()

  const userId = req.userId

  const packageTypes = await PackageType.find(
    {
      created_by: userId
    },
    {
      package: 1
    }
  )

  if (!packageTypes) {
    const error = new Error('Package type does not exist!')
    error.statusCode = 404
    throw error
  }

  let allPackages = []

  packageTypes.forEach(pkgTypeDoc => {
    const packageTypeId = pkgTypeDoc._id

    if (pkgTypeDoc.package?.items?.length) {
      pkgTypeDoc.package.items.forEach((item, index) => {
        allPackages.push({
          ...item.toObject(), // convert Mongoose subdocument to plain object
          package_type_id: packageTypeId,
          index: index
        })
      })
    }
  })

  res.json({
    status: 'Success',
    statusCode: 200,
    message: 'Data fetched successfully',
    data: {
      country,
      allPackages
    }
  })
}

exports.postCompanyAPI = async (req, res, next) => {
  try {
    const userId = req.userId

    // Use the uploaded file if it exists
    const imageUrl = req.file ? req.file.filename : ''

    const {
      first_name,
      last_name,
      company_name,
      email,
      password,
      country_id,
      state_id,
      city_id,
      address,
      status,
      phone,
      website,
      package_id,
      pincode,
      gst_no,
      pan_no
    } = req.body

    // Optional: hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    const user = new User({
      first_name,
      last_name,
      company_name,
      email,
      password: hashedPassword, // Use hashedPassword if hashing
      country_id,
      state_id,
      city_id,
      address,
      status,
      phone,
      website,
      package_id,
      pincode,
      gst_no,
      pan_no,
      photo: imageUrl ? `/img/user-profile/${imageUrl}` : '',
      company_id: 0,
      master_company_id: 0,
      parent_company_id: 0,
      created_by: userId
    })

    await user.save()

    await replaceTemplateField({
      userId: user._id.toString(),
      notificationId: '6878cd0351dcbae6759e8912',
      to: email.trim(),
      event: 'Company Registration',
      means: 'Company Registration',
      explanation: 'Company registration successfully',
      userPassword: password
    })

    res.status(200).json({
      status: 'Success',
      statusCode: 200,
      message: 'Company created successfully'
    })
  } catch (error) {
    next(error)
  }
}

exports.checkEmailCompanyAPI = async (req, res, next) => {
  const email = req.params.email
  const id = req.params.id

  const query = {
    email: email
  }
  if (id && id !== 'null' && id !== 'undefined') {
    query._id = {
      $ne: id
    }
  }

  const userExist = await User.findOne(query)
  res.json({
    exists: !!userExist
  }) // returns { exists: true } or { exists: false }
}

exports.editCompanyAPI = async (req, res, next) => {
  try {
    const userId = req.userId
    const companyId = req.params.id

    const users = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(companyId),
          created_by: new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $lookup: {
          from: 'countries',
          let: {
            cid: '$country_id'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    '$country_id',
                    {
                      $toInt: '$$cid'
                    }
                  ]
                }
              }
            }
          ],
          as: 'country'
        }
      },
      {
        $lookup: {
          from: 'package_types',
          let: {
            pid: '$package_id'
          },
          pipeline: [
            {
              $unwind: '$package.items'
            },
            {
              $match: {
                $expr: {
                  $eq: ['$package.items._id', '$$pid']
                }
              }
            },
            {
              $project: {
                _id: 0,
                name: '$package.items.name',
                amount: '$package.items.amount',
                status: '$package.items.status'
              }
            }
          ],
          as: 'package'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'created_by',
          pipeline: [
            {
              $project: {
                first_name: 1,
                last_name: 1,
                email: 1,
                photo: 1,
                phone: 1
              }
            }
          ],
          as: 'company_user'
        }
      },
      {
        $unwind: {
          path: '$package',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$country',
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $project: {
          email: 1,
          phone: 1,
          status: 1,
          first_name: 1,
          last_name: 1,
          package_id: 1,
          photo: 1,
          country_id: 1,
          state_id: 1,
          city_id: 1,
          pincode: 1,
          address: 1,
          company_name: 1,
          pan_no: {
            $cond: [{ $eq: ['$pan_no', 'undefined'] }, null, '$pan_no']
          },
          gst_no: {
            $cond: [{ $eq: ['$gst_no', 'undefined'] }, null, '$gst_no']
          },
          website: {
            $cond: [{ $eq: ['$website', 'undefined'] }, null, '$website']
          },
          country: '$country.country_name',
          company_user: 1,
          package: '$package.name',
          package_amount: '$package.amount'
        }
      }
    ])

    const company = users?.[0] || null

    if (!company) {
      return errorResponse(res, 'Company not found or access denied', {}, 404)
    }

    const finalData = {
      ...company,
      email: decrypt(company?.email),
      phone: decrypt(company?.phone),
      company_user:
        company.company_user?.map(user => ({
          ...user,
          email: user?.email ? decrypt(user.email) : null,
          phone: user?.phone ? decrypt(user.phone) : null
        })) || []
    }

    return successResponse(res, 'Data fetched successfully', finalData)
  } catch (error) {
    return errorResponse(res, 'Internal server error', {}, 500)
  }
}

exports.deleteCompanyAPI = async (req, res, next) => {
  try {
    const id = req.params.id

    await User.findByIdAndDelete(id)

    return successResponse(res, 'User deleted successfully')
  } catch (error) {
    return errorResponse(res, 'Internal server error', {}, 500)
  }
}

exports.putCompanyAPI = async (req, res, next) => {
  try {
    const userId = req.userId
    const id = req.params.id

    const data = await User.findOne({
      created_by: userId,
      _id: id
    })

    const imageUrl = req.file ? req.file.filename : ''

    const {
      first_name,
      last_name,
      company_name,
      email,
      country_id,
      state_id,
      city_id,
      address,
      status,
      phone,
      website,
      package_id,
      pincode,
      gst_no,
      pan_no
    } = req.body

    data.first_name = first_name
    data.last_name = last_name
    data.company_name = company_name
    data.email = email
    data.phone = phone
    data.address = address
    data.pincode = pincode
    data.package_id = package_id
    data.country_id = country_id
    data.state_id = state_id
    data.city_id = city_id
    data.gst_no = gst_no
    data.pan_no = pan_no
    data.website = website
    data.status = status

    if (imageUrl && imageUrl != '') {
      data.photo = imageUrl
    }

    await data.save()

    res.status(200).json({
      status: 'Success',
      statusCode: 200,
      message: 'Company updated successfully!'
    })
  } catch (error) {
    console.error('Error occured', error)
  }
}

exports.getCountryAPI = async (req, res, next) => {
  const country = await Country.find()
  res.json({
    status: 'Success',
    statusCode: 200,
    message: 'Data fetched successfully',
    data: {
      country
    }
  })
}

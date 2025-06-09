const User = require('../../model/User');
const Role = require('../../model/Role');
const RoleUser = require('../../model/RoleUser');
const Country = require('../../model/Country');
const PackageType = require('../../model/PackageType');
const bcrypt = require('bcryptjs')
const { ObjectId } = require('mongoose');
const { encryptDeterministic, hashSearchField } = require('../../util/encryption');

const { hash, normalizeEmail, normalizePhone } = require('../../util/encryption');
const { successResponse, errorResponse, warningResponse } = require('../../util/response');


const pick = (obj, fields) => Object.fromEntries(fields.map(key => [key, obj[key]]));

exports.getCompanyIndexAPI = async (req, res, next) => {

    const userId = req.userId;
    const company = await User.find({ created_by: userId });

    res.status(200).json({
        'status': 'Success',
        'statusCode': 200,
        'message': 'Data successfully fetched!',
        data: {
            company,
        }
    });
}

exports.createUserAPI = async (req, res, next) => {
    try {
        const userId = req.userId;

        const imageUrl = req.file?.filename
            ? `/img/user-profile/${req.file.filename}`
            : '';

        const allowedFields = [
            'first_name','first_name_search', 'last_name', 'email', 'country_id', 'state_id',
            'city_id', 'address', 'status', 'phone', 'dob', 'website',
            'pincode', 'designation_id', 'urn_no', 'idfa_code',
            'application_no', 'licence_no', 'zone_id','employee_type','participation_type_id'
        ];

        const existingUser = await User.findOne({ email_hash: hash(normalizeEmail(req.body.email)) });

        if (existingUser) {
            return errorResponse(res,'Email already exists',{}, 400);
        }

        const userData = pick(req.body, allowedFields);

        const hashedPassword = await bcrypt.hash(req.body.password, 12);

        let processedCodes = [];
        if (req.body.user_code != undefined) {
            const result = await processEmployeeCodesForUser({
                rawCodes: req.body.user_code,
                userId: null,         // No userId yet since new user
                existingUser: null
            });

            console.log(result);
            
            if (!result.success) {
                return errorResponse(res,result.message,{}, 400);
            }

            processedCodes = result.codes;
        }

        const user = new User({
            ...userData,
            photo: imageUrl,
            password: hashedPassword,
            company_id: userId,
            master_company_id: userId,
            parent_company_id: userId,
            created_by: userId,
            codes: processedCodes,
        });

        await user.save();

        // Handle roles from request
        const roles = Array.isArray(req.body.roles)
        ? req.body.roles
        : typeof req.body.roles === 'string'
        ? req.body.roles.split(',').map(role => role.trim())
        : [];

        const roleDocs = await Role.find({ _id: { $in: roles } });

        console.log('roleDocs', roleDocs);
        const roleUserInserts = roleDocs.map(role => ({
            user_id: user._id,
            role_id: role._id,
            assigned_by: userId,
        }));

        console.log('roleUserInserts', roleUserInserts);

        await RoleUser.insertMany(roleUserInserts);

        return successResponse(res, "User created successfully!", user);
    } catch (error) {
        console.log('error', error);
        next(error);
    }
};

const processEmployeeCodesForUser = async ({ rawCodes, userId, existingUser = null }) => {
    let parsedCodes = [];
    try {
      parsedCodes = rawCodes;
      if (!Array.isArray(parsedCodes)) {
        parsedCodes = [parsedCodes];
      }
    } catch {
      return { success: true, codes: existingUser?.codes || [] };
    }
  
    if (parsedCodes.length === 0) {
      return { success: true, codes: existingUser?.codes || [] };
    }

  
    const normalizedCodes = parsedCodes
      .map(code => (code != null ? String(code).trim() : ''))
      .filter(Boolean);

    //  console.log('normalizedCodes', normalizedCodes);
    const duplicateUsers = await User.find({
     // _id: { $ne: userId },
      'codes.code': { $in: normalizedCodes }
    }).select('codes');

    //console.log('duplicateUsers', duplicateUsers);
  
    const foundCodes = new Set();
    for (const user of duplicateUsers) {
      user.codes.forEach(c => {
        const codeLower = c.code;
        if (normalizedCodes.includes(codeLower)) {
          foundCodes.add(codeLower);
        }
      });
    }
    if (foundCodes.size > 0) {
      return {
        success: false,
        message: 'Duplicate employee ID(s) found in other users.',
        duplicates: Array.from(foundCodes)
      };
    }
  
    // Map existing codes for quick lookup
    const existingCodesMap = new Map(
      (existingUser?.codes || []).map(c => [c.code.toLowerCase(), c])
    );
  
    // Mark all existing codes inactive
    const updatedExistingCodes = (existingUser?.codes || []).map(codeObj => ({
      ...codeObj.toObject ? codeObj.toObject() : codeObj, // convert mongoose doc to plain object if needed
      type: 'inactive',
    }));
  
    // Add new codes as active only if they don't already exist
    for (const code of normalizedCodes) {
      if (!existingCodesMap.has(code)) {
        updatedExistingCodes.push({
          code,
          issued_on: new Date(),
          type: 'active',
        });
      } else {
        // If code exists, mark it active (override inactive)
        const index = updatedExistingCodes.findIndex(c => c.code.toLowerCase() === code);
        if (index !== -1) {
          updatedExistingCodes[index].type = 'active';
        }
      }
    }
  
    return { success: true, codes: updatedExistingCodes };
  };

exports.updateUserAPI = async (req, res, next) => {
    try {
        const userId = req.params.id; // assuming user ID is passed in URL
        const currentUser = req.userId;

        const existingUser = await User.findById(userId);

        if (!existingUser) {
            return errorResponse(res, "User not found", 404);
        }

        const imageUrl = req.file?.filename
            ? `/img/user-profile/${req.file.filename}`
            : undefined;

        const allowedFields = [
            'first_name', 'last_name', 'email', 'country_id', 'state_id',
            'city_id', 'address', 'status', 'phone', 'dob', 'website',
            'pincode', 'designation_id', 'urn_no', 'idfa_code',
            'application_no', 'licence_no', 'zone_id','employee_type','participation_type_id'
        ];

        const updateData = pick(req.body, allowedFields);

        // Optional password update
        if (req.body.password) {
            updateData.password = await bcrypt.hash(req.body.password, 12);
        }

        // Handle employee_codes from string
        if (req.body.user_code != undefined) {
            const result = await processEmployeeCodesForUser({
                rawCodes: req.body.user_code,
                userId,
                existingUser
            });
            
            if(result.success){
                updateData.codes = result.codes;
            }
        }
            

        // Optional photo update
        if (imageUrl) {
            updateData.photo = imageUrl;
        }


        const roles = Array.isArray(req.body.roles)
        ? req.body.roles
        : typeof req.body.roles === 'string'
        ? req.body.roles.split(',').map(r => r.trim())
        : [];

        // Clear previous roles
        await RoleUser.deleteMany({ user_id: userId });

        // Insert new roles
        if (roles.length > 0) {
            const roleUserDocs = roles.map(roleId => ({
                user_id: userId,
                role_id: roleId
            }));
            await RoleUser.insertMany(roleUserDocs);
        }

        updateData.updated_by = currentUser;

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
            new: true,
            runValidators: true
        });

        if (!updatedUser) {
            return errorResponse(res, "User not found", 400);
        }

        return successResponse(res, "User updated successfully!", updatedUser);
    } catch (error) {
        next(error);
    }
};

exports.attachNewUserCodeAPI = async (req, res, next) => {
    try {
        const userId = req.params.id; // assuming user ID is passed in URL
        const existingUser = await User.findById(userId);
  
        const updateData = {};

       // console.log('existingUser', existingUser, req.body.user_code);
        // Handle employee_codes from string
        if (req.body.user_code != undefined) {
            const result = await processEmployeeCodesForUser({
                rawCodes: req.body.user_code,
                userId,
                existingUser
            });
            
            console.log('result.codes', result);
            if(!result.success){
                return errorResponse(res, result.message, 400);
            }else{
                updateData.codes = result.codes;
            }
        }
         
        updateData.updated_by = req.userId;
        const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
            new: true,
            runValidators: true
        });

        if (!updatedUser) {
            return errorResponse(res, "User not found", 400);
        }

        return successResponse(res, "New Employee ID added as Active status.", {codes: updatedUser.codes, emp_id: updatedUser.emp_id });
    } catch (error) {
        next(error);
    }
};

exports.markActiveUserCodeAPI = async (req, res, next) => {
    try {
        
        const userId = req.params.id;
        const index = parseInt(req.body.index); // Ensure index is an integer

        const existingUser = await User.findById(userId);
        if (!existingUser || !Array.isArray(existingUser.codes)) {
            return errorResponse(res, `User or codes not found`, 400);
        }

        const currentCode = existingUser.codes[index];
        if (!currentCode) {
            return errorResponse(res, `Code at index ${index} not found`, 400);
        }

        // Flip 'type' to 'active'
        existingUser.codes[index].type = 'active';

        existingUser.codes = existingUser.codes.map((code, i) => ({
        ...code,
        type: i === index ? 'active' : 'inactive'
        }));

        await existingUser.save();

        return successResponse(res, `Employee ID changed for ${existingUser.first_name}`, {codes: existingUser.codes});
    } catch (error) {
        next(error);
    }
};

exports.updateStatusAPI = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return errorResponse(res, `User not found`, 400);
        }

        user.status = req.body.status;
        await user.save();

        return successResponse(res, `${user.first_name} account status marked as ${(user.status ? 'Active' : 'Inactive')} `, {current_status: user.status});
    } catch (error) {
        next(error);
    }
};

exports.checkEmailCompanyAPI = async (req, res, next) => {
    const email = req.params.email;
    const id = req.params.id;

    const query = { email: email };
    if (id && id !== 'null' && id !== 'undefined') {
        query._id = { $ne: id };
    }

    const userExist = await User.findOne(query);
    res.json({ exists: !!userExist }); // returns { exists: true } or { exists: false }
};

exports.editAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const user = await User.findOne({ _id: req.params.id, created_by: userId }).populate({
            path: 'roles',
            // populate: {
            //   path: 'role_id', // Assuming RoleUser has `role_id`
            //   model: 'roles'
            // }
          });

        if (!user) {
            return errorResponse(res, 'User not found!', 400);
        }
        return successResponse(res, "User loaded", user);
    } catch (error) {
        console.error("Error occurred:", error);
        return errorResponse(res, error, 500);
    }
};

exports.updatePasswordAPI = async (req, res, next) => {
    try {
        const userId = req.params.id; // assuming user ID is passed in URL
        const currentUser = req.userId;
 
        const updateData = {};
        updateData.updated_by = currentUser;

        // Optional password update
        if (req.body.password) {
            updateData.password = await bcrypt.hash(req.body.password, 12);
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
            new: true,
            runValidators: true
        });

        if (!updatedUser) {
            return errorResponse(res, "User not found", 400);
        }

        return successResponse(res, "Password updated successfully!", updatedUser._id);
    } catch (error) {
        next(error);
    }
}

exports.deleteAPI = async (req, res, next) => {
    try {
        const user = await User.findOne({ _id: req.params.id });
        if (!user) {
            return warningResponse(res, "User not found.", {}, 404);
        }
        await user.deleteOne();
        return successResponse(res, "User deleted successfully!", {}, 200);
    } catch (err) {
        return errorResponse(res, "Failed to delete user", err, 500);
    }
};

exports.searchUserAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const user = await User.findOne({ email_hash: hash(normalizeEmail('alok@gmail.com')) });
        // if (user) {
        // const obj = user.toObject({ getters: true });
        // console.log(obj.email);  // decrypted email
        // }
        return successResponse(res, "Data loaded", user);
    } catch (error) {
        console.error("Error occurred:", error);
        return errorResponse(res, error, 500);
    }
};
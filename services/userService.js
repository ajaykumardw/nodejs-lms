const Role = require('../model/Role');
const Country = require('../model/Country');
const RoleUser = require('../model/RoleUser');
const User = require('../model/User');
const bcrypt = require('bcryptjs')

const importUsers = async (res, userId, chunk, roleIds = []) => {
  try {
    const emails = chunk.map(u => u.Email?.toLowerCase().trim()).filter(Boolean);
    const existing = await User.find({ email: { $in: emails } }).select('email').lean();
    const existingEmails = new Set(existing.map(u => u.email));

    const phones = chunk.map(u => u.PhoneNo ? String(u.PhoneNo).trim() : null).filter(Boolean);
    const existing2 = await User.find({ phone: { $in: phones } }).select('phone').lean();
    const existingPhones = new Set(existing2.map(u => u.phone));

    const usersToInsert = [];
    const resultWithStatus = [];

    for (const u of chunk) {
      const email = u.Email?.toLowerCase().trim();
      const phone = u.PhoneNo ? String(u.PhoneNo).trim() : null;
      const safeUser = JSON.parse(JSON.stringify(u)); // Make it plain
      let errors = {}; // collect all errors here

      let validate = true;
      if (existingEmails.has(email)) {
          errors.email = 'This email has already been taken!';
        }

        if (existingPhones.has(phone)) {
          errors.phone = 'This phone has already been taken!';
        }

        const result = await processEmployeeCodesForUser({
          rawCodes: u.EmpID,
          userId: null,
          existingUser: null,
        });
  
        if (!result.success) {
          errors.emp_id = result.message ;
        }

        if (Object.keys(errors).length > 0) {
          resultWithStatus.push({ ...safeUser, errors });
          continue;
        }

      

      if (validate) {
        try {
          
          const passwordRaw = u.password || u.EmpID || Math.floor(1111 + Math.random() * 8888).toString();
          const hashedPassword = await bcrypt.hash(passwordRaw, 12);

          const location = await getLocationByName(u.Country, u.State, u.City);

          usersToInsert.push({
            email,
            phone,
            first_name: u.FirstName.trim(),
            last_name: u.LastName.trim(),
            password: hashedPassword,
            address: u.Address,
            country_id: location?.country || null,
            state_id: location?.state || null,
            city_id: location?.city || null,
            pincode: u.PinCode,
            status: u.Status?.toLowerCase() === 'active' ? true : (u.Status?.toLowerCase() === 'inactive' ? false : null),
            application_no: u.ApplicationNo || '',
            licence_no: u.LicenseNo || '',
            urn_no: u.URNNumber || '',
            website: u.Website || '',
            codes: result.codes || [],
            company_id: userId,
            master_company_id: userId,
            parent_company_id: userId,
            created_by: userId,
          });

          resultWithStatus.push({ ...safeUser, error: '' });

        } catch (innerErr) {
          console.error('User insert error:', innerErr);
          resultWithStatus.push({ ...safeUser, error: 'Error processing this user' });
        }
      }
    }

    let insertedUsers = [];
    if (usersToInsert.length > 0) {
      insertedUsers = await User.insertMany(usersToInsert);

      if (roleIds.length > 0) {
        const roleDocs = await Role.find({ _id: { $in: roleIds } });

        const roleUserInserts = [];
        for (const user of insertedUsers) {
          for (const role of roleDocs) {
            roleUserInserts.push({
              user_id: user._id,
              role_id: role._id,
              assigned_by: userId,
            });
          }
        }

        if (roleUserInserts.length > 0) {
          await RoleUser.insertMany(roleUserInserts);
        }
      }
    }

    return {
      success: true,
      message: `${usersToInsert.length} users imported.`,
      imported: usersToInsert.length,
      data: resultWithStatus,
    };
  } catch (error) {
    console.error("Import Error:", error);
    return {
      success: false,
      message: 'An error occurred during import.',
      imported: 0,
      data: [],
    };
  }
};


const getLocationByName = async (countryName, stateName, cityName) => {
    const countryDoc = await Country.findOne({
        country_name: new RegExp(`^${countryName.trim()}$`, 'i') // case-insensitive exact match
    }).lean();
  
    if (!countryDoc) return { country: '', state: '', city: '' };
  
    const stateDoc = countryDoc.states.find(
      s => s.state_name.trim().toLowerCase() === stateName.trim().toLowerCase()
    );
  
    const cityDoc = stateDoc?.cities?.find(
      c => c.city_name.trim().toLowerCase() === cityName.trim().toLowerCase()
    );
  
    return {
      country: countryDoc.country_id,
      state: stateDoc?.state_id || '',
      city: cityDoc?.city_id || ''
    };
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
  }

const getUserStats = async () => {
  try {
    const [total, active, inactive] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: true }),
      User.countDocuments({ status: false }),
      //User.countDocuments({ last_login: { $exists: false } }) // or: { $eq: null }
    ]);

    return {
      total_users: total,
      active_users: active,
      inactive_users: inactive,
      not_logged_in_users: 0,
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    throw error;
  }
};

  
module.exports = {
    importUsers,
    getUserStats
}
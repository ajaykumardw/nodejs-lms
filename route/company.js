const express = require('express');
const router = express.Router();
const zoneController = require('../controller/Company/ZoneAPIController');
const regionController = require('../controller/Company/RegionAPIController');
const isAuth = require('../middleware/is-auth')
const companyValidation = require('../validation/Companyvalidation')

//This route is for zone
router.get('/zone', isAuth, zoneController.getZoneAPIData);
router.post('/zone', isAuth, zoneController.postZoneAPI);
router.put('/zone/:id', isAuth, zoneController.putZoneAPI);


//This route is for region
router.get('/region', isAuth, regionController.getRegionAPI);
router.post('/region', isAuth, regionController.postRegionAPI);
router.post('/data/region', isAuth, regionController.postRegionAPI);
router.get('region/create', isAuth, regionController.createRegionAPI);

module.exports = router;
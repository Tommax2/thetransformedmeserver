import express from 'express';
import { getAnalyticsData, getDailySalesData} from '../controllers/analytics.controller.js';
import { adminRoute, protectRoute } from '../middleware/auth.middle.js';

const router = express.Router();

router.get('/', protectRoute, adminRoute,  async(req, res) => {
 try{

    const analyticsData = await getAnalyticsData();
     // Assume this function fetches analytics data

     const endDate = new Date();
     const starData = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000 );
     
     const dailySalesData = await getDailySalesData(starData, endDate);

     res.json({
      analyticsData,
      dailySalesData
     })

 }catch(error){
   console.log("Error in analytics route", error.message);
   res.status(500).json({ message: "Server Error", error: error.message });
    
 }

})

export default router;
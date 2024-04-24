const AccessModel = require('../models/Access');

module.exports = {

    async fund(access_id, pointsToFund) {
        try {
            const access = await AccessModel.findOne({ access_id: access_id });

            if (!access) {
                return { 
                    success: false,
                    message: 'No record found with the given access ID.',
                };
            }

            const updatedAccess = await AccessModel.findOneAndUpdate(
                { access_id: access_id },
                {
                    $inc: { points: +pointsToFund },
                    $set: { updated: new Date() }
                },
                { new: true }
            );

            if (updatedAccess) {
                return {
                    success: true,
                    message: "Successfully funded user.",
                    beforeAction:access.points - pointsToFund,
                    AfterAction:access.points,
                }
            } else {
                return { 
                    success: false,
                    message: 'Error updating the record.'  ,
                    beforeAction:access.points,
                    AfterAction:access.points,
                };
            }
        } catch (error) {
            return { 
                success: false,
                message: 'Database operation failed',
            };
        }
    },

    async deduct(access_id, pointsToDeduct) {
        try {
            const access = await AccessModel.findOne({ access_id: access_id });

            if (!access) {
                return { 
                    success: false,
                    message: 'No record found with the given access ID.',
                };
            }

            if (access.points < pointsToDeduct) {
                return { 
                    success: false,
                    message: 'Not enough points to deduct.',
                    beforeAction:access.points,
                    AfterAction:access.points,
                };
            }

            const updatedAccess = await AccessModel.findOneAndUpdate(
                { access_id: access_id },
                {
                    $inc: { points: -pointsToDeduct },
                    $set: { updated: new Date() }
                },
                { new: true }
            );

            if (updatedAccess) {
                return {
                    success: true,
                    message: "Successfully deducted rate.",
                    beforeAction:access.points + pointsToDeduct,
                    AfterAction:access.points,
                }
            } else {
                return { 
                    success: false,
                    message: 'Error updating the record.'  ,
                    beforeAction:access.points,
                    AfterAction:access.points,
                };
            }
        } catch (error) {
            return { 
                success: false,
                message: 'Database operation failed',
            };
        }
    }
}

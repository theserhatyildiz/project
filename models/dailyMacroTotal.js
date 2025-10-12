const mongoose = require('mongoose');

const dailyMacroTotalSchema = mongoose.Schema({
    
    userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
            },
    
    eatenDate:{
        type:String,
        default:new Date().toLocaleDateString()
    },
    
    totalProtein: { 
        type: Number, 
        required: true 
    },
    
    totalCarbs: { 
        type: Number, 
        required: true 
    },
    
    totalFats: { 
        type: Number, 
        required: true 
    },
    
    totalFiber: {
         type: Number, 
         required: true 
        }

}, { timestamps: true });

dailyMacroTotalSchema.index({ userId: 1, eatenDate: 1 }, { unique: true });

const dailyMacroTotal = mongoose.model('dailyMacroTotal', dailyMacroTotalSchema);

module.exports = dailyMacroTotal;
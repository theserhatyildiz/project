const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name: {
        type: String, 
        required: true
    },
    email: {
        type: String,  
        required: true 
    },
    password: {
        type: String,  
        required: true
    },
    weightTrackingStartDate: {
        type: Date,
        default: null // Bu kisi kilo takibi icin yeni bir baslangic tarihi secmede kullaniliyor
    },
    macroCoachStartedAt: {
        type: Date, // Bu kisinin makro coach i baslattigi tarih
    },

    lastCheckInAt: { 
        type: Date, // Bu kisim checkin leri takip etmek icin
    },

    isVerified: {
        type: Boolean,
        default: false
    },
    emailToken: {
        type: String,
    },
    hasSubmittedCoachForm: { 
        type: Boolean, 
        default: false 
    }
},{timestamps:true})

const userModel = mongoose.model("users",userSchema);

module.exports = userModel;
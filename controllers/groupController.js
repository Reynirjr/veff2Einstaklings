exports.list = (req, res) => {
    res.render('groups');
};

// When creating a group or round
const inputOpenTime = req.body.inputOpenTime; // already in HH:MM format from the form
const inputCloseTime = req.body.inputCloseTime;
 var moment      = require('moment');
var log         = require('bristol');
var audit       = require('../../modules/audit-log');
var splitFile   = require('split-file');

var getLongestString = function (arr, callback) {
    if (arr.length > 1) { // si le tableau contient au moins deux sous elements
        var arrSorted = arr.sort(function (a, b) {
            return b.length - a.length;
        });
        var longest = arrSorted[0];
        var longest1 = arrSorted[1];
        if (longest.length > longest1.length) {
            callback(longest);
        } else {//longest == longest1, we find le patient with the longest name
            var arrayWithSameLenthSortedContent = arr.sort(function (a, b) {
                return b.toString().length - a.toString().length;
            });
            callback(arrayWithSameLenthSortedContent[0]);
        }
    }
}
exports.getLongestString = getLongestString;

var hl7Gender = function (gender) {
    if (gender.substring(0, 1).toLowerCase() === 'f') {
        return "female";
    }
    if (gender.substring(0, 1).toLowerCase() === 'm') {
        return "male";
    }
    if (gender.substring(0, 2).toLowerCase() === 'nk') {
        return "not known";
    }


};
exports.hl7Gender = hl7Gender;

var getTunnelGender = function (gender) {
    if (gender == undefined || gender == null || gender.length < 1) {
        return "";
    } else {
        return gender.substring(0, 1).toUpperCase();
    }
};
exports.getTunnelGender = getTunnelGender;

var intToBoolean = function (val) {
    if (val === '1') {
        return true;
    } else {
        return false;
    }
};

var getValideDate = function (date) {
    if (date == undefined || date == "") {
        return null;
    } else {
        var year = parseInt(date.slice(4, 8));
        var month = parseInt(date.slice(2, 4)) - 1;
        var day = parseInt(date.slice(0, 2));
        var result = new Date(Date.UTC(year, month, day));
        return result;
    }
};
exports.getValideDate = getValideDate;

var getTunnelDate = function (date) {
    if (date == undefined || date == null) {
        return "";
    } else {
        return moment(date).format("DDMMYYYY");
    }
};
exports.getTunnelDate = getTunnelDate;

var getNadisDate = function (date) {
    if (date == undefined || date == null) {
        return "";
    } else {
        return moment(date).format("YYYYMMDDHHmm");
    }
};
exports.getNadisDate = getNadisDate;

var makeUniqueId = function (length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};
exports.makeUniqueId = makeUniqueId;

var isEmptyOrNull = function (val) {
    if (val == undefined || val.toLowerCase() === "null" || val.toLowerCase() === null || val.trim() == "") {
        return true;
    } else {
        return false;
    }
};
exports.isEmptyOrNull = isEmptyOrNull;

var isEmptyCsv = function (val) {
    if (!val || val == undefined) {
        return true;
    } else {
        var isEmptyLine = true
        for (var i = 0; i < val.length; i++) {
            if (isEmptyOrNull(val[i]) == false) {
                isEmptyLine = false;
            }
        }
        return isEmptyLine;
    }
};
exports.isEmptyCsv = isEmptyCsv;

var getValideCsvDate = function (date) {
    if (date == undefined || date == "") {
        return null;
    } else {
        return moment(date, 'DD/MM/YYYY').toDate();
    }
};
exports.getValideCsvDate = getValideCsvDate;

var setEmptyIfNull = function (val) {
    if (val == undefined || val.toLowerCase() === "null" || val.toLowerCase() === null) {
        return "";
    } else {
        return val;
    }
};
exports.setEmptyIfNull = setEmptyIfNull;

var isValidPastOrPresentDateCSV = function (date) {
    var theDate = getValideCsvDate(date);
    if (theDate === null) {
        return false;
    } else if (new Date() >= theDate) {
        return true;
    } else {
        return false;
    }
};
exports.isValidPastOrPresentDateCSV = isValidPastOrPresentDateCSV;

var split = function (path, chunckSize, callback) {
    splitFile.splitFileBySize(path, chunckSize).then((names) => {
        callback(null, names);
    }).catch((err) => {
        callback(err);
    });
};
exports.split = split;

function queryStringToJSON(txt) {
    var pairs = txt.split('&');

    var result = {};
    pairs.forEach(function (pair) {
        pair = pair.split('=');
        if (pair[0] != '' &&  pair[1] && pair[1] != ''){
            result[pair[0]] = decodeURIComponent(pair[1] || '');
        }
    });

    return JSON.parse(JSON.stringify(result));
}

exports.queryStringToJSON = queryStringToJSON;
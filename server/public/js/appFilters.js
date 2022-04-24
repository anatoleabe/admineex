angular.module('datetimeFilters', []).filter('dMMMM', function (gettextCatalog, $window) {
    var months = new Array(gettextCatalog.getString("January"),
            gettextCatalog.getString("February"),
            gettextCatalog.getString("March"),
            gettextCatalog.getString("April"),
            gettextCatalog.getString("May"),
            gettextCatalog.getString("June"),
            gettextCatalog.getString("July"),
            gettextCatalog.getString("August"),
            gettextCatalog.getString("September"),
            gettextCatalog.getString("October"),
            gettextCatalog.getString("November"),
            gettextCatalog.getString("December"));
    return function (str) {
        var toReturn = '';
        if ($window.localStorage.language == 'FR') {
            toReturn = stringToDate(str).getDate() + ' ' + months[stringToDate(str).getMonth()];
        } else {
            toReturn = months[stringToDate(str).getMonth()] + ' ' + stringToDate(str).getDate();
        }
        return toReturn;
    }
}).filter('ddMMyyyy', function (gettextCatalog, $filter) {
    return function (str) {
        var toReturn = gettextCatalog.getString("unknown");
        if (str && str != "") {
            toReturn = $filter('date')(str, "dd/MM/yyyy");
        }
        return toReturn;
    }
}).filter('HHmm', function () {
    return function (received) {
        return HHmm(received);
    }
}).filter('smartDatetime', function (gettextCatalog, $window) {
    return function (datetime) {
        if (datetime && datetime != "") {
            var now = new Date;
            datetime = stringToDate(datetime);

            if ((datetime.getDate() == now.getDate()) && (datetime.getMonth() == now.getMonth()) && (datetime.getFullYear() == now.getFullYear())) {
                return HHmm(datetime);
            } else if ((datetime.getDate() + 1 == now.getDate()) && (datetime.getMonth() == now.getMonth()) && (datetime.getFullYear() == now.getFullYear())) {
                return gettextCatalog.getString("Yesterday");
            } else if ((now.getDate() - 7 < datetime.getDate()) && (datetime.getMonth() == now.getMonth()) && (datetime.getFullYear() == now.getFullYear())) {
                var weekDays = new Array(gettextCatalog.getString("Sunday"),
                        gettextCatalog.getString("Monday"),
                        gettextCatalog.getString("Tuesday"),
                        gettextCatalog.getString("Wednesday"),
                        gettextCatalog.getString("Thursday"),
                        gettextCatalog.getString("Friday"),
                        gettextCatalog.getString("Saturday"));
                return weekDays[datetime.getDay()];
            } else {
                var months = new Array(gettextCatalog.getString("January"),
                        gettextCatalog.getString("February"),
                        gettextCatalog.getString("March"),
                        gettextCatalog.getString("April"),
                        gettextCatalog.getString("May"),
                        gettextCatalog.getString("June"),
                        gettextCatalog.getString("July"),
                        gettextCatalog.getString("August"),
                        gettextCatalog.getString("September"),
                        gettextCatalog.getString("October"),
                        gettextCatalog.getString("November"),
                        gettextCatalog.getString("December"));

                var toReturn = '';
                toReturn = datetime.getDate() + ' ' + months[datetime.getMonth()] + ' ' + datetime.getFullYear();
                return toReturn;
            }
        } else {
            return "";
        }
    }
});


angular.module('limitFilters', []).filter('limitMessage', function () {
    return function (str) {
        if (str.length > 27) {
            str = str.substr(0, 24) + "...";
        }
        return str;
    }
}).filter('limitSender', function () {
    return function (str) {
        var counter = "";
        if (str.length > 19) {
            counter = str.substring(str.indexOf("("), str.indexOf(")") + 1);
            str = str.substr(0, 16) + "...";
        }
        str = str + counter;
        return str;
    }
}).filter('limiNotification', function () {
    return function (str) {
        if (str.length > 63) {
            str = str.substr(0, 60) + "...";
        }
        return str;
    }
}).filter('regex', function () {
    return function (input, field, regex) {
        var out = [];
        if (input) {
            var patt = new RegExp(regex);
            for (var i = 0; i < input.length; i++) {
                if (patt.test(input[i][field]))
                    out.push(input[i]);
            }
        }
        return out;
    };
});


angular.module('mappingFilters', []).filter('address', function (gettextCatalog) {
    return function (address) {
        var toReturn = "";
        if (address) {
            if (address.line && address.line.length > 0) {
                toReturn = address.line[0] + " ";
            }
            if (address.line && address.line.length > 1) {
                toReturn += address.line[1] + " ";
            }
            if (address.district && address.district != "") {
                toReturn += "(" + address.district + ") ";
            }
            if (address.city) {
                toReturn += address.city + " ";
            }
            if (address.postalCode && address.postalCode != "") {
                toReturn += address.postalCode + " ";
            }
            if (address.state) {
                toReturn += "(" + address.state + ") ";
            }
            if (address.country) {
                toReturn += address.country + " ";
            }
        }

        if (toReturn == "") {
            toReturn = gettextCatalog.getString("unknown");
        }
        return toReturn;
    }
}).filter('role', function (gettextCatalog) {
    return function (role) {
        var toReturn = gettextCatalog.getString("unknown");
        switch (role) {
            case '1':
                toReturn = gettextCatalog.getString("Administrator");
                break;
            case '2':
                toReturn = gettextCatalog.getString("Manager");
                break;
            case '3':
                toReturn = gettextCatalog.getString("Global supervisor");
                break;
            case '4':
                toReturn = gettextCatalog.getString("Editor");
                break;
        }
        return toReturn;
    }
}).filter('unknown', function (gettextCatalog) {
    return function (str) {
        var toReturn = str;
        if (toReturn === undefined || toReturn == " " || toReturn == "") {
            toReturn = gettextCatalog.getString("unknown");
        }
        return toReturn;
    }
}).filter('language', function (gettextCatalog) {
    return function (language) {
        var toReturn = "";
        switch (language) {
            case 'FR':
                toReturn = gettextCatalog.getString("French");
                break;
            case 'EN':
                toReturn = gettextCatalog.getString("English");
                break;
            case 'RU':
                toReturn = gettextCatalog.getString("Russian");
                break;
            case 'ES':
                toReturn = gettextCatalog.getString("Spanish");
                break;
            case 'PT':
                toReturn = gettextCatalog.getString("Portuguese");
                break;
            default:
                toReturn = gettextCatalog.getString("unknown");
                break;
        }
        return toReturn;
    }
}).filter('phone', function (gettextCatalog) {
    return function (telecom) {
        var toReturn = gettextCatalog.getString("unknown");
        for (i = 0; i < telecom.length; i++) {
            if (telecom[i].system == "phone" && telecom[i].value && telecom[i].value != "") {
                toReturn = telecom[i].value;
            }
        }
        return toReturn;
    }
}).filter('email', function (gettextCatalog) {
    return function (telecom) {
        var toReturn = "unknown";
        for (i = 0; i < telecom.length; i++) {
            if (telecom[i].system == "email" && telecom[i].value != "") {
                toReturn = telecom[i].value;
            }
        }
        return toReturn;
    }
}).filter('html', function ($sce) {
    return function (text) {
        return $sce.trustAsHtml(text);
    };
}).filter('projectStatus', function (gettextCatalog) {
    return function (value) {
        var toReturn = gettextCatalog.getString("unknown");
        switch (value) {
            case '1':
                toReturn = gettextCatalog.getString("In talks");
                break;
            case '2':
                toReturn = gettextCatalog.getString("Proposal sent");
                break;
            case '3':
                toReturn = gettextCatalog.getString("Accepted");
                break;
            case '4':
                toReturn = gettextCatalog.getString("Signed");
                break;
            case '5':
                toReturn = gettextCatalog.getString("Completed");
                break;
            case '6':
                toReturn = gettextCatalog.getString("Canceled");
                break;
        }
        return toReturn;
    }
}).filter('organizationType', function (gettextCatalog) {
    return function (value) {
        var toReturn = gettextCatalog.getString("unknown");
        switch (value) {
            case '1':
                toReturn = gettextCatalog.getString("Community");
                break;
            case '2':
                toReturn = gettextCatalog.getString("Developed Country NGO");
                break;
            case '3':
                toReturn = gettextCatalog.getString("Developing Country NGO");
                break;
            case '4':
                toReturn = gettextCatalog.getString("Donors");
                break;
            case '5':
                toReturn = gettextCatalog.getString("Foundation");
                break;
            case '6':
                toReturn = gettextCatalog.getString("Private Sector");
                break;
            case '7':
                toReturn = gettextCatalog.getString("Technical Agency");
                break;
            case '8':
                toReturn = gettextCatalog.getString("Government");
                break;
            case '9':
                toReturn = gettextCatalog.getString("Funder");
                break;
            case '10':
                toReturn = gettextCatalog.getString("Research Consortium");
                break;
        }
        return toReturn;
    }
}).filter('revenueType', function (gettextCatalog) {
    return function (value) {
        var toReturn = gettextCatalog.getString("unknown");
        switch (value) {
            case '1':
                toReturn = gettextCatalog.getString("One Shot Sales");
                break;
            case '2':
                toReturn = gettextCatalog.getString("Recurring Sales");
                break;
            case '3':
                toReturn = gettextCatalog.getString("Subsidy");
                break;
            case '4':
                toReturn = gettextCatalog.getString("Service");
                break;
        }
        return toReturn;
    }
}).filter('sickness', function (gettextCatalog) {
    return function (value) {
        var toReturn = gettextCatalog.getString("unknown");
        switch (value) {
            case '0':
                toReturn = gettextCatalog.getString("Generic");
                break;
            case '1':
                toReturn = gettextCatalog.getString("TB");
                break;
            case '2':
                toReturn = gettextCatalog.getString("HIV");
                break;
            case '3':
                toReturn = gettextCatalog.getString("Ebola");
                break;
            case '4':
                toReturn = gettextCatalog.getString("Malaria");
                break;
        }
        return toReturn;
    }
}).filter('status', function (gettextCatalog) {
    return function (value) {
        var toReturn = gettextCatalog.getString("unknown");
        switch (value) {
            case '1':
                toReturn = gettextCatalog.getString("Not started");
                break;
            case '2':
                toReturn = gettextCatalog.getString("In progress");
                break;
            case '3':
                toReturn = gettextCatalog.getString("Completed");
                break;
            case '4':
                toReturn = gettextCatalog.getString("Blocked");
                break;
        }
        return toReturn;
    }
}).filter('product', function (gettextCatalog) {
    return function (value) {
        var toReturn = gettextCatalog.getString("unknown");
        switch (value) {
            case '1':
                toReturn = gettextCatalog.getString("DataToCare");
                break;
            case '2':
                toReturn = gettextCatalog.getString("MediScout");
                break;
            case '3':
                toReturn = gettextCatalog.getString("Selfics");
                break;
            case '4':
                toReturn = gettextCatalog.getString("Alics");
                break;
        }
        return toReturn;
    }
}).filter('uppercase', function () {
    return function (str) {
        if (str && str.toUpperCase)
            return str.toUpperCase();
        return str;
    }
}).filter('matricule', function () {
    return function (str) {
        if (str && str != null) {
            return str.toUpperCase();
        } else {
            return "";
        }

    }
}).filter('translate', function (gettextCatalog) {
    return function (str) {
        return gettextCatalog.getString(str);
    }
}).filter('gender', function (gettextCatalog) {
    return function (gender) {
        var toReturn = "";
        switch (gender) {
            case 'F':
                toReturn = gettextCatalog.getString("Female");
                break;
            case 'M':
                toReturn = gettextCatalog.getString("Male");
                break;
            default:
                toReturn = gettextCatalog.getString("unknown");
                break;
        }
        return toReturn;
    }
}).filter('dateHuman', function (gettextCatalog, $filter) {
    return function (str) {
        var toReturn = gettextCatalog.getString("unknown");
        if (str && str != "") {
            toReturn = $filter('date')(str, "dd/MM/yyyy");
        }
        return toReturn;
    }
}).filter('dateOnlyYear', function (gettextCatalog, $filter) {
    return function (str) {
        var toReturn = "";
        if (str && str != "") {
            toReturn = $filter('date')(str, "yyyy");
        }
        return toReturn;
    }
}).filter('truncateTexte', function (gettextCatalog, $filter) {
    return function (str) {
        var toReturn = "";
        if (str && str != "" && str.length > 60) {
            toReturn = str.substring(0, 60) + "...";
        } else {
            return str;
        }
        return toReturn;
    }
});


function HHmm(received) {
    if (typeof received == 'string') {
        received = stringToDate(received);
    }
    //UTC
    received = new Date(received.getTime() - received.getTimezoneOffset() * 60000);
    var h = addZero(received.getHours());
    var m = addZero(received.getMinutes());
    return h + ":" + m;
}

function stringToDate(str) {
    var a = str.split(/[^0-9]/);
    return new Date(a[0], a[1] - 1, a[2], a[3], a[4], a[5]);
}

function addZero(str) {
    str = str.toString();
    if (str.length == 1) {
        str = "0" + str;
    }
    return str;
}
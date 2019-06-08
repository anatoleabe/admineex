angular.module('StaffService', []).factory('Staff', function($http) {
    return {
        list: function(info) {
            return $http.get('/api/personnel/'+info.minify);
        },
        read: function(info) {
            return $http.get('/api/personnel/read/' + info.id+'/'+info.beautify);
        },
        search: function(info) {
            return $http.get('/api/personnel/search/' + info.text);
        },
        eligible: function(info) {
            return $http.get('/api/personnel/eligible/' + info.id);
        },
        upsert: function(info) {
            return $http.put('/api/personnel', info);
        },
        delete: function(info) {
            return $http.delete('/api/personnel/' + info.id);
        },
        pdf1: function() {
            return $http.get('/api/pdf/pdf1/');
        },
        checkExistance: function(info) {
            return $http.get('/api/personnel/checkExistance/'+ info.mat);
        }
    }
});
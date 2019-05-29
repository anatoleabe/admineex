angular.module('StaffService', []).factory('Staff', function($http) {
    return {
        list: function(info) {
            return $http.get('/api/personnel/'+info.minify);
        },
        read: function(info) {
            return $http.get('/api/personnel/read/' + info.id);
        },
        search: function(info) {
            return $http.get('/api/personnel/search/' + info.text);
        },
        upsert: function(info) {
            return $http.put('/api/personnel', info);
        },
        delete: function(info) {
            return $http.delete('/api/personnel/' + info.id);
        }
    }
});
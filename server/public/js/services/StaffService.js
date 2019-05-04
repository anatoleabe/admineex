angular.module('StaffService', []).factory('Staff', function($http) {
    return {
        list: function() {
            return $http.get('/api/personnel');
        },
        read: function(info) {
            return $http.get('/api/personnel/' + info.id);
        },
        upsert: function(info) {
            return $http.put('/api/personnel', info);
        },
        delete: function(info) {
            return $http.delete('/api/personnel/' + info.id);
        }
    }
});
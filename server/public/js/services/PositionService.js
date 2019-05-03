angular.module('PositionService', []).factory('Position', function($http) {
    return {
        list: function(filter) {
            return $http.get('/api/positions/id/' + filter.id);
        },
        read: function(info) {
            return $http.get('/api/positions/read/' + info.id);
        },
        upsert: function(info) {
            return $http.put('/api/positions', info);
        },
        delete: function(info) {
            return $http.delete('/api/positions/' + info.id);
        }
    }
});
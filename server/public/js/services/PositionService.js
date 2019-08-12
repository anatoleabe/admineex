angular.module('PositionService', []).factory('Position', function($http) {
    return {
        list: function(filter) {
            return $http.get('/api/positions/id/' + filter.id+'/restric/'+filter.restric+ '/' + filter.limit + '/' + filter.skip);
        },
        read: function(info) {
            return $http.get('/api/positions/read/' + info.id);
        },
        upsert: function(info) {
            return $http.put('/api/positions', info);
        },
        delete: function(info) {
            return $http.delete('/api/positions/' + info.id);
        },
        find: function(info) {
            return $http.get('/api/positions/find/' + info.code);
        },
        affect: function(info) {
            return $http.put('/api/positions/affect/', info);
        }
    }
});
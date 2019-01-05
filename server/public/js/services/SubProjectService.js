angular.module('SubProjectService', []).factory('SubProject', function($http) {
    return {
        list: function() {
            console.log("Service Get");
            return $http.get('/api/subprojects');
        },
        read: function(info) {
            return $http.get('/api/subprojects/' + info.id);
        },
        create: function(info) {
            return $http.post('/api/subprojects', info);
        },
        update: function(info) {
            return $http.put('/api/subprojects/' + info._id, info);
        },
        delete: function(info) {
            return $http.delete('/api/subprojects/' + info.id);
        }
    }
});
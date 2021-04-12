angular.module('CategoryService', []).factory('Category', function($http) {
    return {
        list: function() {
            return $http.get('/api/categories');
        },
        read: function(info) {
            return $http.get('/api/categories/' + info.id);
        },
        upsert: function(info) {
            console.log("info", info)
            return $http.put('/api/categories', info);
        },
        delete: function(info) {
            return $http.delete('/api/categories/' + info.id);
        }
    }
});
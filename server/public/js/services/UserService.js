angular.module('UserService', []).factory('User', function($http) {
    return {
        list: function() {
            return $http.get('/api/users');
        },
        contacts: function() {
            return $http.get('/api/users/contacts');
        },
        read: function(info) {
            return $http.get('/api/users/' + info.id);
        },
        create: function(info) {
            return $http.post('/api/users', info);
        },
        sendPassword: function(info) {
            return $http.post('/api/users/password/send', info);
        },
        update: function(info) {
            return $http.put('/api/users/' + info._id, info);
        },
        delete: function(info) {
            return $http.delete('/api/users/' + info.id);
        }
    }
});

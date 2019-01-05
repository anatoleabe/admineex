angular.module('AccountService', []).factory('Account', function($http) {
    return {
        signin: function(user) {
            return $http.post('/api/account/signin', user);
        },
        
        lostPassword: function(user) {
            return $http.post('/api/account/password/lost', user);
        },
        
        resetPassword: function(user) {
            return $http.post('/api/account/password/reset', user);
        },
 
        signout: function() {
            return $http.get('/api/account/signout');
        },

        signup: function(user) {
            return $http.post('/api/account/signup', user);
        },
        
        activation: function(user) {
            return $http.post('/api/account/activation', user);
        },

        changePassword: function(user) {
            return $http.post('/api/account/password/change', user);
        },
        
        read: function() {
            return $http.get('/api/account/profile');
        },
        
        update: function(user) {
            return $http.put('/api/account', user);
        }
    }
});
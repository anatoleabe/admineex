angular.module('NotificationService', []).factory('Notification', function($http) {
    return {
        list: function() {
            return $http.get('/api/notifications');
        },
        
        update: function(notification) {
            return $http.put('/api/notifications/' + notification._id);
        }
    }
});
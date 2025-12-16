angular.module('WelcomeCtrl', []).controller('WelcomeController', function ($scope, $state, $window) {
    $scope.isAuthenticated = Boolean($window.localStorage.token);

    $scope.goToSignin = function () {
        $state.go('signin');
    };

    $scope.goToApp = function () {
        $state.go('home.dashboard.main');
    };
});


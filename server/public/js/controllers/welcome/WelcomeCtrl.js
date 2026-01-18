angular.module('WelcomeCtrl', []).controller('WelcomeController', function ($scope, $state, $window) {
    $scope.isAuthenticated = Boolean($window.localStorage.token);
    $scope.darkMode = $window.localStorage.getItem('darkMode') === 'true';
    if ($scope.darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }

    $scope.toggleDarkMode = function () {
        $scope.darkMode = !$scope.darkMode;
        $window.localStorage.setItem('darkMode', $scope.darkMode);
        if ($scope.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    };

    $scope.goToSignin = function () {
        $state.go('signin');
    };

    $scope.goToApp = function () {
        $state.go('home.dashboard.main');
    };
});

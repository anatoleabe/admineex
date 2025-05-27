angular.module('LostCtrl', []).controller('LostController', function($scope, gettextCatalog, $ocLazyLoad, $injector, $state, $mdToast) {
    $ocLazyLoad.load('js/services/AccountService.js').then(function() {
        $scope.loading = false;
        var Account = $injector.get('Account');

        // Persist dark mode preference
        $scope.darkMode = localStorage.getItem('darkMode') === 'true';
        if ($scope.darkMode) document.body.classList.add('dark-mode');
        $scope.toggleDarkMode = function() {
            $scope.darkMode = !$scope.darkMode;
            localStorage.setItem('darkMode', $scope.darkMode);
            if ($scope.darkMode) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        };

        $scope.submit = function() {
            if (!$scope.email) {
                $mdToast.show(
                    $mdToast.simple()
                    .textContent(gettextCatalog.getString('Please enter your email address.'))
                    .position('top left right')
                    .hideDelay(3000)
                );
                return;
            }
            $scope.loading = true;
            Account.lostPassword({
                email: $scope.email
            }).then(function(response) {
                var data = response.data;
                $scope.loading = false;
                $scope.email = '';
                if(!data.exists){
                    $mdToast.show(
                        $mdToast.simple()
                        .textContent(gettextCatalog.getString('If your email exists in our system, you will receive a password reset link.'))
                        .position('top left right')
                        .hideDelay(3000)
                    );
                } else {
                    $state.go("signin", {"isLost": true});
                }
            }).catch(function(response) {
                $scope.loading = false;
                $mdToast.show(
                    $mdToast.simple()
                    .textContent(gettextCatalog.getString('A server error occurred. Please try again.'))
                    .position('top left right')
                    .hideDelay(3000)
                );
            });
        }
    });
});

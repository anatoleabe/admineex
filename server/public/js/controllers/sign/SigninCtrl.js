angular.module('SigninCtrl', []).controller('SigninController', function($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $stateParams, $mdToast, $mdDialog, $rootScope) {    
    $scope.loading = false;
    $scope.showPassword = false;
    $scope.currentYear = new Date().getFullYear();
    $scope.loginError = null;
    
    $ocLazyLoad.load('js/services/AccountService.js').then(function() {
        var Account = $injector.get('Account');
        
        if($window.localStorage.token){
            $state.transitionTo('home.dashboard.main');
        }

        // If the user came from reset password state
        if($stateParams.isResetted && $stateParams.email){
            $scope.loginSuccess = gettextCatalog.getString("Votre mot de passe a été changé avec succès. Vous pouvez maintenant vous connecter.");
            $scope.email = $stateParams.email;
            if ($rootScope && $rootScope.setFocus) {
                $rootScope.setFocus('password');
            }
            $stateParams.isResetted = null;
            $stateParams.email = null;
        }

        // If the user came from lost password page
        if($stateParams.isLost){
            $scope.loginSuccess = gettextCatalog.getString("Un email a été envoyé à votre adresse email avec un lien pour réinitialiser votre mot de passe.");
            $stateParams.isLost = null;
        }

        $scope.signin = function signin() {
            $scope.loginError = null;
            
            if (!$scope.email || !$scope.password) {
                $scope.loginError = gettextCatalog.getString('Veuillez saisir votre email et votre mot de passe.');
                return;
            }
            
            $scope.loading = true;
            Account.signin({
                email: $scope.email,
                password: $scope.password,
                rememberme: $scope.rememberMe
            }).then(function(response) {
                var data = response.data;
                if(data.activated){
                    $window.localStorage.language = data.language;
                    $window.localStorage.token = data.token;
                    $state.transitionTo('home.dashboard.main');
                } else {
                    $scope.loginError = gettextCatalog.getString('Compte non activé. Veuillez contacter l\'administrateur.');
                }
                $scope.loading = false;
            }).catch(function(response) {
                $scope.loading = false;
                $scope.password = "";
                
                if(response.status === 401){
                    $scope.loginError = gettextCatalog.getString('L\'email ou le mot de passe que vous avez saisi est incorrect.');
                } else if(response.status === 429) {
                    $scope.loginError = gettextCatalog.getString('Trop de tentatives de connexion. Veuillez réessayer plus tard.');
                } else {
                    $scope.loginError = gettextCatalog.getString('Une erreur s\'est produite. Veuillez réessayer plus tard.');
                }
            });
        };
        
        $scope.handleKeyPress = function(event) {
            if (event.keyCode === 13 && !$scope.loading) {
                $scope.signin();
            }
        };
    });
});

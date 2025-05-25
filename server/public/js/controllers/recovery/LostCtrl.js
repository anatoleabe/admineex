angular.module('LostCtrl', []).controller('LostController', function($scope, gettextCatalog, $ocLazyLoad, $injector, $state, $mdToast) {
    $scope.loading = false;
    $scope.currentYear = new Date().getFullYear();
    $scope.recoveryError = null;
    $scope.recoverySuccess = null;
    
    $ocLazyLoad.load('js/services/AccountService.js').then(function() {
        var Account = $injector.get('Account');
        
        $scope.submit = function() {
            if (!$scope.email) {
                $scope.recoveryError = gettextCatalog.getString('Veuillez saisir votre adresse email.');
                return;
            }
            
            $scope.loading = true;
            $scope.recoveryError = null;
            $scope.recoverySuccess = null;
            
            Account.lostPassword({
                email: $scope.email
            }).then(function(response) {
                var data = response.data;
                $scope.loading = false;
                
                if(!data.exists){
                    $scope.recoveryError = gettextCatalog.getString('Aucun compte trouvé avec cette adresse email.');
                } else {
                    $scope.recoverySuccess = gettextCatalog.getString('Un email a été envoyé à votre adresse avec les instructions pour réinitialiser votre mot de passe.');
                    
                    setTimeout(function() {
                        $state.go("signin", {"isLost": true});
                    }, 3000);
                }
            }).catch(function(response) {
                $scope.loading = false;
                $scope.recoveryError = gettextCatalog.getString('Une erreur s\'est produite, veuillez réessayer plus tard.');
            });
        };
        
        $scope.handleKeyPress = function(event) {
            if (event.keyCode === 13 && !$scope.loading) {
                $scope.submit();
            }
        };
    });
});

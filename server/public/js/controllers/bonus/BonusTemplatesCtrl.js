app.controller('BonusTemplatesCtrl', ['$scope', '$http', '$state', 'BonusService', '$mdDialog', '$mdToast', 
function($scope, $http, $state, BonusService, $mdDialog, $mdToast) {
    $scope.templates = [];
    $scope.loading = true;
    $scope.filters = {
        activeOnly: true,
        category: '',
        search: ''
    };
    
    $scope.categories = [
        { id: 'with_parts', name: 'Avec parts' },
        { id: 'without_parts', name: 'Sans parts' },
        { id: 'fixed_amount', name: 'Montant fixe' },
        { id: 'percentage', name: 'Pourcentage' },
        { id: 'custom_formula', name: 'Formule personnalisée' }
    ];
    
    $scope.periodicities = [
        { id: 'daily', name: 'Quotidien' },
        { id: 'weekly', name: 'Hebdomadaire' },
        { id: 'monthly', name: 'Mensuel' },
        { id: 'quarterly', name: 'Trimestriel' },
        { id: 'semesterly', name: 'Semestriel' },
        { id: 'yearly', name: 'Annuel' },
        { id: 'on_demand', name: 'Sur demande' }
    ];
    
    $scope.loadTemplates = function() {
        $scope.loading = true;
        BonusService.getTemplates($scope.filters).then(function(response) {
            $scope.templates = response.data;
            $scope.loading = false;
        }).catch(function(error) {
            $scope.loading = false;
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Erreur lors du chargement des modèles de prime')
                    .position('top right')
                    .hideDelay(3000)
            );
        });
    };
    
    $scope.createTemplate = function() {
        $state.go('home.bonus.templates.new');
    };
    
    $scope.editTemplate = function(template) {
        $state.go('home.bonus.templates.edit', { id: template._id });
    };
    
    $scope.toggleTemplate = function(template) {
        var action = template.isActive ? 'deactivateTemplate' : 'activateTemplate';
        BonusService[action](template._id).then(function() {
            $scope.loadTemplates();
            $mdToast.show(
                $mdToast.simple()
                    .textContent(template.isActive ? 'Modèle désactivé' : 'Modèle activé')
                    .position('top right')
                    .hideDelay(3000)
            );
        }).catch(function(error) {
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Erreur lors de la modification du statut du modèle')
                    .position('top right')
                    .hideDelay(3000)
            );
        });
    };
    
    $scope.cloneTemplate = function(template) {
        BonusService.cloneTemplate(template._id).then(function() {
            $scope.loadTemplates();
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Modèle cloné avec succès')
                    .position('top right')
                    .hideDelay(3000)
            );
        }).catch(function(error) {
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Erreur lors du clonage du modèle')
                    .position('top right')
                    .hideDelay(3000)
            );
        });
    };
    
    $scope.deleteTemplate = function(ev, template) {
        var confirm = $mdDialog.confirm()
            .title('Confirmation de suppression')
            .textContent('Êtes-vous sûr de vouloir supprimer ce modèle de prime?')
            .ariaLabel('Confirmation de suppression')
            .targetEvent(ev)
            .ok('Supprimer')
            .cancel('Annuler');
            
        $mdDialog.show(confirm).then(function() {
            BonusService.deleteTemplate(template._id).then(function() {
                $scope.loadTemplates();
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Modèle supprimé avec succès')
                        .position('top right')
                        .hideDelay(3000)
                );
            }).catch(function(error) {
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Erreur lors de la suppression du modèle')
                        .position('top right')
                        .hideDelay(3000)
                );
            });
        });
    };
    
    $scope.getCategoryName = function(categoryId) {
        var category = $scope.categories.find(function(cat) {
            return cat.id === categoryId;
        });
        return category ? category.name : categoryId;
    };
    
    $scope.getPeriodicityName = function(periodicityId) {
        var periodicity = $scope.periodicities.find(function(per) {
            return per.id === periodicityId;
        });
        return periodicity ? periodicity.name : periodicityId;
    };
    
    $scope.filterByCategory = function(category) {
        $scope.filters.category = category;
        $scope.loadTemplates();
    };
    
    $scope.clearFilters = function() {
        $scope.filters = {
            activeOnly: true,
            category: '',
            search: ''
        };
        $scope.loadTemplates();
    };
    
    $scope.loadTemplates();
}]);

app.controller('BonusTemplateCtrl', ['$scope', '$http', '$state', 'BonusService', '$mdDialog', '$mdToast', '$stateParams',
function($scope, $http, $state, BonusService, $mdDialog, $mdToast, $stateParams) {
    $scope.template = {
        name: '',
        description: '',
        category: 'with_parts',
        periodicity: 'monthly',
        isActive: true,
        eligibilityRules: [],
        calculationConfig: {
            partRules: [],
            fixedAmount: 0,
            percentage: 0,
            baseField: 'salary',
            customFormula: ''
        },
        approvalWorkflow: {
            type: 'sequential',
            steps: [
                { role: 'manager', required: true },
                { role: 'director', required: true }
            ]
        }
    };
    
    $scope.isEdit = !!$stateParams.id;
    $scope.loading = false;
    $scope.saving = false;
    
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
    
    $scope.workflowTypes = [
        { id: 'sequential', name: 'Séquentiel' },
        { id: 'parallel', name: 'Parallèle' }
    ];
    
    $scope.roles = [
        { id: 'manager', name: 'Manager' },
        { id: 'director', name: 'Directeur' },
        { id: 'admin', name: 'Administrateur' },
        { id: 'rh', name: 'Ressources Humaines' }
    ];
    
    $scope.operators = [
        { id: '$eq', name: 'Égal à' },
        { id: '$ne', name: 'Différent de' },
        { id: '$gt', name: 'Supérieur à' },
        { id: '$gte', name: 'Supérieur ou égal à' },
        { id: '$lt', name: 'Inférieur à' },
        { id: '$lte', name: 'Inférieur ou égal à' },
        { id: '$in', name: 'Dans la liste' },
        { id: '$nin', name: 'Pas dans la liste' }
    ];
    
    $scope.fields = [
        { id: 'status', name: 'Statut' },
        { id: 'category', name: 'Catégorie' },
        { id: 'rank', name: 'Rang' },
        { id: 'grade', name: 'Grade' },
        { id: 'salary', name: 'Salaire' },
        { id: 'structure', name: 'Structure' }
    ];
    
    if ($scope.isEdit) {
        $scope.loading = true;
        BonusService.getTemplate($stateParams.id).then(function(response) {
            $scope.template = response.data;
            $scope.loading = false;
        }).catch(function(error) {
            $scope.loading = false;
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Erreur lors du chargement du modèle')
                    .position('top right')
                    .hideDelay(3000)
            );
            $state.go('home.bonus.templates.main');
        });
    }
    
    $scope.addEligibilityRule = function() {
        $scope.template.eligibilityRules.push({
            field: 'status',
            operator: '$eq',
            value: ''
        });
    };
    
    $scope.removeEligibilityRule = function(index) {
        $scope.template.eligibilityRules.splice(index, 1);
    };
    
    $scope.addPartRule = function() {
        $scope.template.calculationConfig.partRules.push({
            conditions: [
                { field: 'category', operator: '$eq', value: '' }
            ],
            parts: 1
        });
    };
    
    $scope.removePartRule = function(index) {
        $scope.template.calculationConfig.partRules.splice(index, 1);
    };
    
    $scope.addCondition = function(rule) {
        rule.conditions.push({
            field: 'category',
            operator: '$eq',
            value: ''
        });
    };
    
    $scope.removeCondition = function(rule, index) {
        rule.conditions.splice(index, 1);
    };
    
    $scope.addWorkflowStep = function() {
        $scope.template.approvalWorkflow.steps.push({
            role: 'manager',
            required: true
        });
    };
    
    $scope.removeWorkflowStep = function(index) {
        $scope.template.approvalWorkflow.steps.splice(index, 1);
    };
    
    $scope.saveTemplate = function() {
        $scope.saving = true;
        
        var savePromise;
        if ($scope.isEdit) {
            savePromise = BonusService.updateTemplate($stateParams.id, $scope.template);
        } else {
            savePromise = BonusService.createTemplate($scope.template);
        }
        
        savePromise.then(function(response) {
            $scope.saving = false;
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Modèle enregistré avec succès')
                    .position('top right')
                    .hideDelay(3000)
            );
            $state.go('home.bonus.templates.main');
        }).catch(function(error) {
            $scope.saving = false;
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Erreur lors de l\'enregistrement du modèle')
                    .position('top right')
                    .hideDelay(3000)
            );
        });
    };
    
    $scope.validateTemplate = function() {
        BonusService.validateTemplate($scope.template).then(function(response) {
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Le modèle est valide')
                    .position('top right')
                    .hideDelay(3000)
            );
        }).catch(function(error) {
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Le modèle contient des erreurs: ' + (error.data.message || 'Erreur inconnue'))
                    .position('top right')
                    .hideDelay(5000)
            );
        });
    };
    
    $scope.cancel = function() {
        $state.go('home.bonus.templates.main');
    };
    
    if ($scope.template.category === 'with_parts' && $scope.template.calculationConfig.partRules.length === 0) {
        $scope.addPartRule();
    }
    
    if ($scope.template.eligibilityRules.length === 0) {
        $scope.addEligibilityRule();
    }
}]);

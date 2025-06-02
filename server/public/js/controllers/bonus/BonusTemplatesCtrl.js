angular.module('app')
    .controller('BonusTemplatesController', ['$scope', '$http', '$q', 'toastr', function($scope, $http, $q, toastr) {
        // State management
        $scope.state = {
            loading: false,
            saving: false,
            deleting: false,
            viewing: false
        };

        $scope.templates = [];
        $scope.filteredTemplates = [];
        $scope.editingTemplate = null;
        $scope.viewedTemplate = null;
        $scope.templateFormData = null;

        // Filter variables
        $scope.searchQuery = '';
        $scope.statusFilter = '';
        $scope.categoryFilter = '';

        // Constants for dropdown options
        $scope.constants = {
            categories: [
                { value: 'with_parts', label: 'With Parts' },
                { value: 'without_parts', label: 'Without Parts' },
                { value: 'fixed_amount', label: 'Fixed Amount' },
                { value: 'calculated', label: 'Calculated' }
            ],
            periodicities: [
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'semesterly', label: 'Semesterly' },
                { value: 'yearly', label: 'Yearly' },
                { value: 'on_demand', label: 'On Demand' }
            ],
            formulaTypes: [
                { value: 'fixed', label: 'Fixed Amount' },
                { value: 'percentage', label: 'Percentage Based' },
                { value: 'custom_formula', label: 'Custom Formula' },
                { value: 'parts_based', label: 'Parts Based' }
            ],
            operators: [
                { value: 'equals', label: 'Equals' },
                { value: 'not_equals', label: 'Not Equals' },
                { value: 'contains', label: 'Contains' },
                { value: 'greater_than', label: 'Greater Than' },
                { value: 'less_than', label: 'Less Than' },
                { value: 'in', label: 'In' },
                { value: 'not_in', label: 'Not In' }
            ],
            approvalTypes: [
                { value: 'sequential', label: 'Sequential' },
                { value: 'parallel', label: 'Parallel' }
            ]
        };

        // Initialize template form data
        function initializeTemplateForm() {
            $scope.templateFormData = {
                code: '',
                name: '',
                description: '',
                category: 'with_parts',
                periodicity: 'monthly',
                eligibilityRules: [],
                calculationConfig: {
                    formulaType: 'fixed',
                    baseField: '',
                    formula: '',
                    defaultShareAmount: 0,
                    partsConfig: {
                        defaultParts: 1,
                        partRules: []
                    }
                },
                approvalWorkflow: {
                    steps: []
                },
                documentation: '',
                isActive: true
            };
        }

        // Apply filters to templates
        $scope.applyFilters = function() {
            $scope.filteredTemplates = $scope.templates.filter(template => {
                const matchesSearch = !$scope.searchQuery ||
                    template.name.toLowerCase().includes($scope.searchQuery.toLowerCase()) ||
                    template.code.toLowerCase().includes($scope.searchQuery.toLowerCase()) ||
                    (template.description && template.description.toLowerCase().includes($scope.searchQuery.toLowerCase()));

                const matchesStatus = !$scope.statusFilter ||
                    template.isActive.toString() === $scope.statusFilter;

                const matchesCategory = !$scope.categoryFilter ||
                    template.category === $scope.categoryFilter;

                return matchesSearch && matchesStatus && matchesCategory;
            });
        };

        // Reset all filters
        $scope.resetFilters = function() {
            $scope.searchQuery = '';
            $scope.statusFilter = '';
            $scope.categoryFilter = '';
            $scope.applyFilters();
        };

        // Get label for category
        $scope.getCategoryLabel = function(category) {
            const found = $scope.constants.categories.find(c => c.value === category);
            return found ? found.label : category;
        };

        // Get label for periodicity
        $scope.getPeriodicityLabel = function(periodicity) {
            const found = $scope.constants.periodicities.find(p => p.value === periodicity);
            return found ? found.label : periodicity;
        };

        // Get label for formula type
        $scope.getFormulaTypeLabel = function(formulaType) {
            const found = $scope.constants.formulaTypes.find(f => f.value === formulaType);
            return found ? found.label : formulaType;
        };

        // View template details
        $scope.viewTemplate = function(template) {
            $scope.state.viewing = true;
            $scope.viewedTemplate = angular.copy(template);
            $('#modal_view_template').modal('show');
        };

        // Close view modal
        $scope.closeViewModal = function() {
            $('#modal_view_template').modal('hide');
            $scope.state.viewing = false;
            $scope.viewedTemplate = null;
        };

        // Deep clean object before saving (remove empty arrays/objects)
        function cleanTemplateData(data) {
            const cleaned = angular.copy(data);

            // Clean eligibility rules
            if (cleaned.eligibilityRules && cleaned.eligibilityRules.length === 0) {
                delete cleaned.eligibilityRules;
            }

            // Clean approval workflow
            if (cleaned.approvalWorkflow) {
                if (cleaned.approvalWorkflow.steps && cleaned.approvalWorkflow.steps.length === 0) {
                    delete cleaned.approvalWorkflow;
                }
            }

            // Clean calculation config
            if (cleaned.calculationConfig) {
                if (cleaned.calculationConfig.partsConfig) {
                    if (cleaned.calculationConfig.partsConfig.partRules &&
                        cleaned.calculationConfig.partsConfig.partRules.length === 0) {
                        delete cleaned.calculationConfig.partsConfig.partRules;
                    }
                }

                // Remove partsConfig if not needed
                if (cleaned.calculationConfig.formulaType !== 'parts_based' &&
                    cleaned.calculationConfig.partsConfig) {
                    delete cleaned.calculationConfig.partsConfig;
                }
            }

            return cleaned;
        }

        // Validate template before saving
        function validateTemplate(template) {
            const errors = [];

            if (!template.code || !template.code.trim()) {
                errors.push('Template code is required');
            } else if (!/^[A-Z0-9_-]+$/.test(template.code)) {
                errors.push('Template code must contain only uppercase letters, numbers, underscores and dashes');
            }

            if (!template.name || !template.name.trim()) {
                errors.push('Template name is required');
            }

            if (!template.category) {
                errors.push('Category is required');
            }

            if (!template.periodicity) {
                errors.push('Periodicity is required');
            }

            // Validate calculation config
            if (template.calculationConfig) {
                if (template.calculationConfig.formulaType === 'custom_formula' &&
                    (!template.calculationConfig.formula || !template.calculationConfig.formula.trim())) {
                    errors.push('Formula is required for custom formula type');
                }

                if (template.calculationConfig.defaultShareAmount === null ||
                    template.calculationConfig.defaultShareAmount === undefined ||
                    isNaN(template.calculationConfig.defaultShareAmount)) {
                    errors.push('Default share amount is required');
                } else if (template.calculationConfig.defaultShareAmount < 0) {
                    errors.push('Default share amount cannot be negative');
                }

                if (template.calculationConfig.formulaType === 'parts_based') {
                    if (!template.calculationConfig.partsConfig) {
                        errors.push('Parts configuration is required for parts-based calculations');
                    } else {
                        if (template.calculationConfig.partsConfig.defaultParts < 1) {
                            errors.push('Default parts must be at least 1');
                        }

                        // Validate part rules if they exist
                        if (template.calculationConfig.partsConfig.partRules) {
                            template.calculationConfig.partsConfig.partRules.forEach((rule, index) => {
                                if (!rule.condition || !rule.condition.trim()) {
                                    errors.push(`Part rule ${index + 1}: Condition is required`);
                                }
                                if (rule.parts < 0) {
                                    errors.push(`Part rule ${index + 1}: Parts cannot be negative`);
                                }
                            });
                        }
                    }
                }
            }

            // Validate eligibility rules if they exist
            if (template.eligibilityRules) {
                template.eligibilityRules.forEach((rule, index) => {
                    if (!rule.field || !rule.field.trim()) {
                        errors.push(`Eligibility rule ${index + 1}: Field is required`);
                    }
                    if (!rule.operator) {
                        errors.push(`Eligibility rule ${index + 1}: Operator is required`);
                    }
                    if (!rule.value || !rule.value.trim()) {
                        errors.push(`Eligibility rule ${index + 1}: Value is required`);
                    }
                });
            }

            // Validate approval workflow if it exists
            if (template.approvalWorkflow && template.approvalWorkflow.steps) {
                template.approvalWorkflow.steps.forEach((step, index) => {
                    if (!step.role || !step.role.trim()) {
                        errors.push(`Approval step ${index + 1}: Role is required`);
                    }
                    if (!step.approvalType) {
                        errors.push(`Approval step ${index + 1}: Approval type is required`);
                    }
                });
            }

            return errors.length ? errors : null;
        }

        // Load all templates
        function loadTemplates() {
            $scope.state.loading = true;
            return $http.get('/api/bonus/templates')
                .then(function(response) {
                    $scope.templates = response.data;
                    $scope.applyFilters();
                    return $q.resolve(response.data);
                })
                .catch(function(error) {
                    console.error('Error loading templates:', error);
                    toastr.error('Failed to load templates', 'Error');
                    return $q.reject(error);
                })
                .finally(function() {
                    $scope.state.loading = false;
                });
        }

        // Initial load
        loadTemplates();

        // Helper function for category descriptions
        $scope.getCategoryHelp = function(category) {
            const cat = $scope.constants.categories.find(c => c.value === category);
            if (!cat) return 'Select a category';

            switch(category) {
                case 'with_parts': return 'Bonus calculated using a configurable parts system';
                case 'without_parts': return 'Simple bonus without parts calculation';
                case 'fixed_amount': return 'Fixed amount bonus for all eligible personnel';
                case 'calculated': return 'Custom calculated bonus using formulas';
                default: return cat.label;
            }
        };

        // Open create form
        $scope.openTemplateForm = function() {
            $scope.editingTemplate = null;
            initializeTemplateForm();
            $('#modal_basic').modal('show');
            $('a[href="#basic-info"]').tab('show');
        };

        // Edit template
        $scope.editTemplate = function(template) {
            $scope.editingTemplate = template;
            $scope.templateFormData = angular.copy(template);

            // Ensure nested objects exist
            $scope.templateFormData.calculationConfig = $scope.templateFormData.calculationConfig || {};
            $scope.templateFormData.calculationConfig.partsConfig = $scope.templateFormData.calculationConfig.partsConfig || {
                defaultParts: 1,
                partRules: []
            };
            $scope.templateFormData.approvalWorkflow = $scope.templateFormData.approvalWorkflow || { steps: [] };
            $scope.templateFormData.eligibilityRules = $scope.templateFormData.eligibilityRules || [];

            $('#modal_basic').modal('show');
            $('a[href="#basic-info"]').tab('show');
        };

        // Close form modal
        $scope.closeTemplateForm = function() {
            $('#modal_basic').modal('hide');
            $scope.editingTemplate = null;
            $scope.templateFormData = null;
        };

        // Helper functions for eligibility rules
        $scope.addEligibilityRule = function() {
            if (!$scope.templateFormData.eligibilityRules) {
                $scope.templateFormData.eligibilityRules = [];
            }
            $scope.templateFormData.eligibilityRules.push({
                field: '',
                operator: 'equals',
                value: '',
                description: ''
            });
        };

        $scope.removeEligibilityRule = function(index) {
            $scope.templateFormData.eligibilityRules.splice(index, 1);
        };

        $scope.moveEligibilityRule = function(index, direction) {
            if (direction === 'up' && index > 0) {
                const temp = $scope.templateFormData.eligibilityRules[index - 1];
                $scope.templateFormData.eligibilityRules[index - 1] = $scope.templateFormData.eligibilityRules[index];
                $scope.templateFormData.eligibilityRules[index] = temp;
            } else if (direction === 'down' && index < $scope.templateFormData.eligibilityRules.length - 1) {
                const temp = $scope.templateFormData.eligibilityRules[index + 1];
                $scope.templateFormData.eligibilityRules[index + 1] = $scope.templateFormData.eligibilityRules[index];
                $scope.templateFormData.eligibilityRules[index] = temp;
            }
        };

        // Helper functions for parts rules
        $scope.addPartRule = function() {
            if (!$scope.templateFormData.calculationConfig.partsConfig) {
                $scope.templateFormData.calculationConfig.partsConfig = {
                    defaultParts: 1,
                    partRules: []
                };
            }
            if (!$scope.templateFormData.calculationConfig.partsConfig.partRules) {
                $scope.templateFormData.calculationConfig.partsConfig.partRules = [];
            }
            $scope.templateFormData.calculationConfig.partsConfig.partRules.push({
                condition: '',
                parts: 1
            });
        };

        $scope.removePartRule = function(index) {
            $scope.templateFormData.calculationConfig.partsConfig.partRules.splice(index, 1);
        };

        $scope.movePartRule = function(index, direction) {
            if (!$scope.templateFormData.calculationConfig.partsConfig.partRules) return;

            if (direction === 'up' && index > 0) {
                const temp = $scope.templateFormData.calculationConfig.partsConfig.partRules[index - 1];
                $scope.templateFormData.calculationConfig.partsConfig.partRules[index - 1] =
                    $scope.templateFormData.calculationConfig.partsConfig.partRules[index];
                $scope.templateFormData.calculationConfig.partsConfig.partRules[index] = temp;
            } else if (direction === 'down' && index < $scope.templateFormData.calculationConfig.partsConfig.partRules.length - 1) {
                const temp = $scope.templateFormData.calculationConfig.partsConfig.partRules[index + 1];
                $scope.templateFormData.calculationConfig.partsConfig.partRules[index + 1] =
                    $scope.templateFormData.calculationConfig.partsConfig.partRules[index];
                $scope.templateFormData.calculationConfig.partsConfig.partRules[index] = temp;
            }
        };

        // Helper functions for approval workflow
        $scope.addApprovalStep = function() {
            if (!$scope.templateFormData.approvalWorkflow) {
                $scope.templateFormData.approvalWorkflow = { steps: [] };
            }
            if (!$scope.templateFormData.approvalWorkflow.steps) {
                $scope.templateFormData.approvalWorkflow.steps = [];
            }
            $scope.templateFormData.approvalWorkflow.steps.push({
                role: '',
                approvalType: 'sequential',
                description: ''
            });
        };

        $scope.removeApprovalStep = function(index) {
            $scope.templateFormData.approvalWorkflow.steps.splice(index, 1);
        };

        $scope.moveApprovalStep = function(index, direction) {
            if (!$scope.templateFormData.approvalWorkflow.steps) return;

            if (direction === 'up' && index > 0) {
                const temp = $scope.templateFormData.approvalWorkflow.steps[index - 1];
                $scope.templateFormData.approvalWorkflow.steps[index - 1] = $scope.templateFormData.approvalWorkflow.steps[index];
                $scope.templateFormData.approvalWorkflow.steps[index] = temp;
            } else if (direction === 'down' && index < $scope.templateFormData.approvalWorkflow.steps.length - 1) {
                const temp = $scope.templateFormData.approvalWorkflow.steps[index + 1];
                $scope.templateFormData.approvalWorkflow.steps[index + 1] = $scope.templateFormData.approvalWorkflow.steps[index];
                $scope.templateFormData.approvalWorkflow.steps[index] = temp;
            }
        };

        // Save template
        $scope.saveTemplate = function() {
            const validationErrors = validateTemplate($scope.templateFormData);
            if (validationErrors) {
                validationErrors.forEach(error => toastr.warning(error, 'Validation Error'));
                return;
            }

            $scope.state.saving = true;

            const cleanedData = cleanTemplateData($scope.templateFormData);
            const method = $scope.editingTemplate ? 'put' : 'post';
            const url = '/api/bonus/templates' + ($scope.editingTemplate ? '/' + $scope.editingTemplate._id : '');

            $http[method](url, cleanedData)
                .then(function(response) {
                    toastr.success('Template saved successfully', 'Success');
                    loadTemplates();
                    $scope.closeTemplateForm();
                })
                .catch(function(error) {
                    console.error('Error saving template:', error);
                    const errorMsg = error.data && error.data.message ? error.data.message : 'Error saving template';
                    toastr.error(errorMsg, 'Error');
                })
                .finally(function() {
                    $scope.state.saving = false;
                });
        };

        // Delete template
        $scope.confirmDelete = function(template) {
            if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
                return;
            }

            $scope.state.deleting = true;

            $http.delete('/api/bonus/templates/' + template._id)
                .then(function() {
                    toastr.success('Template deleted successfully', 'Success');
                    loadTemplates();
                })
                .catch(function(error) {
                    console.error('Error deleting template:', error);
                    const errorMsg = error.data && error.data.message ? error.data.message : 'Error deleting template';
                    toastr.error(errorMsg, 'Error');
                })
                .finally(function() {
                    $scope.state.deleting = false;
                });
        };
    }]);
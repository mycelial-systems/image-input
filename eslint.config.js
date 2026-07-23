import neostandard, { plugins } from 'newneostandard'

export default [
    ...neostandard({
        ts: true,
        env: ['browser'],
        ignores: ['dist/*', 'public/*', 'test/*.js', 'docs', 'lib.es5.d.ts']
    }),
    {
        plugins: {
            '@stylistic': plugins['@stylistic']
        },
        rules: {
            '@stylistic/indent': ['error', 4, {
                SwitchCase: 1,
                ignoredNodes: ['TemplateLiteral *']
            }],
            '@stylistic/operator-linebreak': 'off',
            '@stylistic/multiline-ternary': 'off',
            '@stylistic/comma-dangle': 'off',
            // House style uses compact type annotations, eg
            // `foo:string|null`, so disable spacing rules that would
            // require `foo: string | null`.
            '@stylistic/key-spacing': 'off',
            '@stylistic/space-infix-ops': 'off',
            '@stylistic/no-multi-spaces': ['error', {
                ignoreEOLComments: true
            }],
            '@stylistic/no-multiple-empty-lines': ['error', {
                max: 1,
                maxEOF: 1
            }]
        }
    },
    {
        files: ['**/*.ts'],
        plugins: {
            '@typescript-eslint': plugins['typescript-eslint'].plugin
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/consistent-type-imports': ['error', {
                prefer: 'type-imports'
            }],
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }]
        }
    }
]

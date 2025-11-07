# TODO - invokej Plugin Discovery System

## Core Vision
Build a cookiecutter-style template and plugin discovery system that makes invokej project initialization intuitive and powerful.

## 1. Template-Based Project Initialization

### MVP - `invokej init` command
- [ ] Interactive wizard for project type selection
- [ ] Basic templates: Node.js, Python, Docker, Full-stack, API
- [ ] Generate pre-configured `tasks.js` with common tasks
- [ ] Create `.invokej.json` config file with project metadata

### Templates to Create
- [ ] Basic - Simple task runner setup
- [ ] Node.js - npm scripts integration
- [ ] Docker - Container management tasks
- [ ] Full-stack - Frontend + backend tasks
- [ ] Python - Virtual env and pip tasks
- [ ] API - REST API with database tasks

## 2. Plugin Marketplace/Registry

### Discovery Commands
- [ ] `invokej plugins search <query>` - Search plugins
- [ ] `invokej plugins list --category=<cat>` - List by category
- [ ] `invokej plugins info <plugin-id>` - Show plugin details
- [ ] `invokej plugins install <plugin-id>` - Install plugin
- [ ] `invokej plugins add-to-tasks <plugin-id>` - Add to tasks.js

### Plugin Categories
- [ ] Productivity (todo, time tracking, notes)
- [ ] DevOps (docker, k8s, terraform)
- [ ] Cloud (AWS, Vercel, Netlify, GCP)
- [ ] Testing (unit, e2e, performance)
- [ ] Database (migrations, backup, seeding)
- [ ] Build Tools (webpack, vite, rollup)
- [ ] Version Control (git flow, releases)
- [ ] Documentation (generation, serving)
- [ ] Security (scanning, auditing)
- [ ] AI/ML (training, deployment)

## 3. Plugin Templates as "Recipes"

### Recipe Collections to Build
- [ ] Django Development Recipe - migrations, runserver, tests, static
- [ ] Next.js Recipe - dev, build, deploy, analyze
- [ ] Microservices Recipe - docker, k8s, service mesh
- [ ] Data Science Recipe - jupyter, training, evaluation
- [ ] JAMStack Recipe - SSG build, CDN deploy, CMS sync
- [ ] Mobile App Recipe - build, test, deploy to stores

## 4. Smart AI Integration

### AI-Friendly Features
- [ ] Well-documented plugin APIs with clear method signatures
- [ ] Natural language plugin discovery
- [ ] Example integrations for each plugin
- [ ] AI can suggest plugins based on project context
- [ ] Standard integration patterns for AI to follow

### AI Assistant Prompts
- [ ] "Add database backup capabilities"
- [ ] "Set up CI/CD pipeline tasks"
- [ ] "Create deployment workflow for Vercel"

## 5. Community Templates

### GitHub-Based Templates
- [ ] Support for `invokej init --template github:user/repo`
- [ ] Template registry at templates.invokej.io
- [ ] Template validation and testing
- [ ] Version management for templates
- [ ] Fork and customize workflow

### Template Structure
```
template/
├── .invokej/
│   ├── config.json      # Template metadata
│   └── plugins.json     # Required plugins
├── tasks.js             # Pre-configured tasks
├── examples/            # Usage examples
└── README.md           # Template documentation
```

## 6. Progressive Enhancement Flow

### User Journey
1. [ ] Start: `invokej init` → basic tasks.js
2. [ ] Discover: Browse available plugins/recipes
3. [ ] Add: `invokej plugins add <plugin>`
4. [ ] Integrate: AI helps add plugin methods to tasks
5. [ ] Customize: Modify tasks for specific needs
6. [ ] Share: Publish as template for others

## 7. Local Plugin Development

### Plugin Creator Tool
- [ ] `invokej plugins create <name>` - Scaffold new plugin
- [ ] Plugin validation and testing framework
- [ ] Local plugin registry (~/.invokej/plugins)
- [ ] Plugin publishing workflow

### Plugin Structure
```
my-plugin/
├── plugin.yaml         # Metadata & method descriptions
├── index.js           # Plugin implementation
├── examples/
│   └── tasks.js      # Example integration
├── test/             # Plugin tests
└── README.md        # Documentation
```

## 8. Discovery Mechanisms

### Showcase Commands
- [ouzefj showcase` - Interactive examples browser
- [ ] `invokej recipes` - Browse complete project setups
- [ ] `invokej starters` - Quick-start templates
- [ ] `invokej trending` - Popular plugins/templates

### Context-Aware Suggestions
- [ ] Detect project type from files (package.json, Dockerfile, etc.)
- [ ] Suggest relevant plugins based on detection
- [ ] "Detected Next.js. Add Vercel deployment tasks?"
- [ ] Smart defaults based on project structure

## 9. Plugin Composition

### Stack Presets
- [ ] MEAN Stack = mongo + express + angular + node
- [ ] MERN Stack = mongo + express + react + node
- [ ] JAMStack = gatsby + netlify + contentful
- [ ] LAMP Stack = linux + apache + mysql + php
- [ ] Data Stack = jupyter + pandas + scikit + deploy

### Composition Commands
- [ ] `invokej init --stack mern`
- [ ] `invokej stacks list`
- [ ] `invokej stacks create`

## 10. Zero-Config Smart Defaults

### Preset System
- [ ] `invokej init --preset nextjs-app`
- [ ] Auto-includes common tasks for the preset
- [ ] Override capability for customization
- [ ] Update mechanism for presets

## Implementation Phases

### Phase 1: Foundation (Completed)
- [x] Core invokej with Context API
- [x] Basic plugin system
- [x] Example plugins (todo_mgr, work_mgr)
- [x] Remove import-global dependency
- [x] Bundle plugins with package for global installation
- [x] Namespace support with nested classes (v0.3.0)

### Phase 2: Discovery (Next)
- [ ] `invokej init` command
- [ ] Basic templates (5-6 types)
- [ ] Local plugin management
- [ ] Plugin integration helpers
- [x] Namespace organization (completed in v0.3.0)

### Phase 3: Registry
- [ ] Online plugin registry
- [ ] Plugin search and install
- [ ] Community templates
- [ ] Version management

### Phase 4: AI-Native
- [ ] AI integration documentation
- [ ] Natural language commands
- [ ] Smart suggestions
- [ ] Auto-generation helpers

### Phase 5: Ecosystem
- [ ] Plugin marketplace
- [ ] Template sharing platform
- [ ] Stack compositions
- [ ] Enterprise features

## Technical Decisions Needed

### Registry Architecture
- [ ] Centralized (npm-style) vs Decentralized (github-based)
- [ ] Plugin versioning strategy
- [ ] Dependency management approach
- [ ] Security and validation model

### Distribution Strategy
- [ ] npm package for wider reach?
- [ ] Standalone binaries?
- [ ] Docker images?

### Documentation Approach
- [ ] Interactive documentation site
- [ ] Video tutorials
- [ ] Example repository
- [ ] AI training data format

## Other Considerations

### Security
- [ ] Plugin sandboxing options
- [ ] Code signing for plugins
- [ ] Security audit requirements
- [ ] Permission system for plugins

### Performance
- [ ] Plugin lazy loading
- [ ] Cache strategy for registry
- [ ] Startup time optimization
- [ ] Bundle size management

### Developer Experience
- [ ] IDE integrations (VS Code extension?)
- [ ] Debugging tools for tasks
- [ ] Task composition helpers
- [ ] Migration tools from other task runners

## Success Metrics
- [ ] Time to first useful task < 2 minutes
- [ ] Plugin discovery to integration < 5 minutes
- [ ] 50+ quality plugins in registry
- [ ] 20+ production-ready templates
- [ ] Active community contributions

## Notes
- The cookiecutter inspiration is key - familiar pattern for developers
- AI integration is a unique differentiator
- Focus on discoverability and progressive disclosure
- Community-driven growth model
- Keep the core simple, let plugins handle complexity

## Recent Changes

### v0.3.0
- Added namespace support for better task organization
- Implemented WallNamespace plugin for project context management
- Support for `namespace:task` notation (e.g., `invokej wall:show`)
- Enhanced CLI with namespace discovery and help display
- Example: `invokej wall:session`, `invokej db:migrate`, `invokej git:feature`
- Nested class approach for clean separation of concerns

### v0.2.2
- Removed `import-global` dependency
- Plugins now bundled and exported via `invokej/plugins`
- Simplified plugin imports for global installation
// Roadmap data v3 — strict hierarchical tree
// Hierarchy: root → domain (intro/test) → sub (intro/test) → topic
// y=0 is TOP (goal), y grows downward toward the start.
// Layout produces zero edge crossings via tidy-tree placement.

const LAYOUT = {
  TOPIC_SPACING: 108,    // horizontal between topic centers
  SUB_GAP: 64,           // horizontal gap between adjacent subdomain columns
  VROW: 96,              // vertical distance between gate rows
  DOMAIN_GAP_V: 140,     // vertical gap between adjacent domain blocks
  MIN_SUB_W: 132,        // minimum subdomain column width
  CENTER_X: 850,         // backbone vertical axis
  CANVAS_W: 1700,
  TOP_MARGIN: 100,
  BOTTOM_MARGIN: 100,
};

// Domain palette (Apple system-color inspired)
const DOMAIN_COLORS = {
  foundations: '#5AC8FA',
  math:        '#BF5AF2',
  data:        '#30D7DD',
  classical:   '#FF9F0A',
  deep:        '#FF375F',
  mlops:       '#66D4CF',
};
const ROOT_COLOR_START = '#cccdd2';
const ROOT_COLOR_GOAL  = '#FFD60A';

// Difficulty (1–5 stars) per test gate.
// Sub-test stars sum within a domain: foundations=5, math=13, data=7,
// classical=13, deep=21, mlops=10.  Total sub+domain stars = 84.
const SUB_DIFFICULTY = {
  python_core: 2, tooling: 1, cs_basics: 2,
  calculus: 4, linalg: 3, stats: 3, prob: 3,
  sql: 2, pydata: 2, viz: 1, data_skills: 2,
  preproc: 2, supervised: 3, ensembles: 3, unsup: 2, evaluation: 3,
  dl_found: 4, frameworks: 2, cnn_cv: 4, rnn_seq: 3, nlp_basics: 3, llms: 5,
  exp_track: 2, cicd: 2, deployment: 3, monitoring: 3,
};
const DOMAIN_DIFFICULTY = {
  foundations: 3, math: 5, data: 3,
  classical: 4,  deep: 5, mlops: 4,
};
// Stars required to attempt each domain test
// (≈75% of the in-domain sub-test stars).
const DOMAIN_THRESHOLD = {
  foundations: 4,
  math:        10,
  data:        6,
  classical:   11,
  deep:        17,
  mlops:       8,
};

// ─── Quiz questions for real tests ────────────────────────────────────
const QUIZ_DATA = {
  python_core_test: {
    passThreshold: 0.75,
    questions: [
      // ── Syntax & Types (4) ──
      { id:'q1', type:'mcq', topic:'Syntax & Types',
        question: 'What does [x**2 for x in range(5) if x % 2] produce?',
        options: ['[0, 1, 4, 9, 16]', '[1, 9]', '[0, 4, 16]', '[1, 4, 9]'],
        correct: 1 },
      { id:'q2', type:'text', topic:'Syntax & Types',
        question: 'What built-in function returns the number of items in a list?',
        accept: ['len', 'len()'] },
      { id:'q3', type:'mcq', topic:'Syntax & Types',
        question: "Which statement about Python's dict is true?",
        options: ['Keys can be lists', 'Keys must be hashable', 'Dicts are ordered only in 3.10+', 'Values must be immutable'],
        correct: 1 },
      { id:'q4', type:'mcq', topic:'Syntax & Types',
        question: 'What is the output of bool([]), bool([0])?',
        options: ['False, False', 'True, True', 'False, True', 'True, False'],
        correct: 2 },
      // ── OOP (4) ──
      { id:'q5', type:'mcq', topic:'OOP',
        question: 'Which dunder method makes an object callable?',
        options: ['__init__', '__call__', '__new__', '__enter__'],
        correct: 1 },
      { id:'q6', type:'text', topic:'OOP',
        question: 'What decorator turns a method into a class-level method that receives cls instead of self?',
        accept: ['classmethod', '@classmethod'] },
      { id:'q7', type:'matching', topic:'OOP',
        question: 'Match each dunder to its purpose.',
        left:  ['__init__', '__repr__', '__iter__', '__getattr__'],
        right: ['Constructor', 'Developer string representation', 'Makes object iterable', 'Called when attribute not found'],
        correct: {0:0, 1:1, 2:2, 3:3} },
      { id:'q8', type:'mcq', topic:'OOP',
        question: 'What does super() do in Python 3?',
        options: ['Calls the parent constructor directly', 'Returns a proxy to the parent class', 'Makes the class abstract', 'Copies parent attributes'],
        correct: 1 },
      // ── Async (3) ──
      { id:'q9', type:'mcq', topic:'Async',
        question: 'What does await do in an async function?',
        options: ['Starts a new thread', 'Suspends execution until the awaitable completes', 'Blocks the event loop', 'Creates a new coroutine'],
        correct: 1 },
      { id:'q10', type:'text', topic:'Async',
        question: 'What function runs the top-level entry point of an asyncio program?',
        accept: ['asyncio.run', 'asyncio.run()'] },
      { id:'q11', type:'mcq', topic:'Async',
        question: 'Which of these is NOT awaitable in Python?',
        options: ['A coroutine', 'A Future object', 'A regular generator', 'An object with __await__'],
        correct: 2 },
      // ── Typing (4) ──
      { id:'q12', type:'mcq', topic:'Typing',
        question: 'What type hint means "a list of integers"?',
        options: ['List<int>', 'list[int]', 'int[]', 'Array[int]'],
        correct: 1 },
      { id:'q13', type:'matching', topic:'Typing',
        question: 'Match each typing construct to its purpose.',
        left:  ['Optional[X]', 'Union[A, B]', 'Protocol', 'TypeVar'],
        right: ['X or None', 'Either A or B', 'Structural subtyping', 'Generic type parameter'],
        correct: {0:0, 1:1, 2:2, 3:3} },
      { id:'q14', type:'mcq', topic:'Typing',
        question: 'What tool performs static type checking for Python?',
        options: ['pylint', 'mypy', 'black', 'pytest'],
        correct: 1 },
      { id:'q15', type:'text', topic:'Typing',
        question: 'What typing construct defines a dict with string keys and int values? Write the type hint.',
        accept: ['dict[str, int]', 'Dict[str, int]', 'dict[str,int]', 'Dict[str,int]'] },
    ]
  }
};

// ─── Nested source data ───────────────────────────────────────────────
const DOMAINS = [
  {
    id: 'foundations', label: 'Foundations',
    intro_hint: 'Set up the toolbelt. Languages, tooling, CS basics — the soil everything else grows in.',
    test_hint:  'Foundations checkpoint. You can ship Python in a Linux box without panicking.',
    // no sub_deps — all parallel
    subs: [
      // topo: intro→[Syntax,Async] parallel; Syntax→OOP→Typing; Async→Typing; Typing→test
      { id: 'python_core', label: 'Python',
        topo: [['i',0],['i',2],[0,1],[2,3],[1,3],[3,'t']],
        intro_hint: 'Pick up Python as your daily driver.',
        test_hint:  'Python proficiency check.',
        topics: [
          { id:'py_syntax',  label:'Syntax & Types', hours: 15, hint:'Variables, control flow, comprehensions, idiomatic Python.' },
          { id:'py_oop',     label:'OOP',            hours: 12, hint:'Classes, dunders, inheritance, dataclasses.' },
          { id:'py_async',   label:'Async',          hours: 10, hint:'asyncio, coroutines, concurrent I/O.' },
          { id:'py_typing',  label:'Typing',         hours: 6,  hint:'Type hints, generics, protocols, mypy.' },
        ]},
      // parallel (no topo): Git, Shell, Docker are independent
      { id: 'tooling', label: 'Tooling',
        intro_hint: 'The IDE-and-terminal toolbelt every engineer needs.',
        test_hint:  'You can clone a repo, branch, ship a Dockerfile and ssh into a box.',
        topics: [
          { id:'git',         label:'Git',     hours: 8,  hint:'Branches, rebase, PR workflow.' },
          { id:'cli',         label:'Shell',   hours: 10, hint:'Bash, pipes, ssh, processes.' },
          { id:'docker_base', label:'Docker',  hours: 12, hint:'Containers, images, reproducible environments.' },
        ]},
      // topo: intro→Algorithms→Data Structures→test
      { id: 'cs_basics', label: 'CS Basics',
        topo: [['i',0],[0,1],[1,'t']],
        intro_hint: 'The minimum CS foundation for technical interviews.',
        test_hint:  'You can talk Big-O without sweating.',
        topics: [
          { id:'algorithms',  label:'Algorithms',      hours: 25, hint:'Sort, search, recursion, DP — interview foundation.' },
          { id:'data_struct', label:'Data Structures', hours: 20, hint:'Arrays, trees, graphs, hash tables.' },
        ]},
    ]
  },
  {
    id: 'math', label: 'Mathematics',
    intro_hint: 'The math under every ML algorithm. Take it slow — this part pays for itself many times over.',
    test_hint:  'Math checkpoint. You can derive gradients and explain Bayes from scratch.',
    sub_deps: [['calculus','prob'],['calculus','stats']],
    subs: [
      // topo: intro→Derivatives→[ChainRule,Multivariate]→Optimization→test
      { id: 'calculus', label: 'Calculus',
        topo: [['i',0],[0,1],[0,2],[1,3],[2,3],[3,'t']],
        intro_hint: 'Derivatives, gradients, the engine that drives learning.',
        test_hint:  'Calculus checkpoint.',
        topics: [
          { id:'cal_deriv', label:'Derivatives',  hours: 10, hint:'Rules of differentiation, partial derivatives.' },
          { id:'cal_chain', label:'Chain Rule',   hours: 6,  hint:"Composition — backprop's only trick." },
          { id:'cal_multi', label:'Multivariate', hours: 12, hint:'Gradients, Jacobians, Hessians.' },
          { id:'cal_optim', label:'Optimization', hours: 15, hint:"Gradient descent, Newton's method, convexity." },
        ]},
      // topo: intro→Vectors→Decompositions→Eigenvalues→test (sequential)
      { id: 'linalg', label: 'Linear Algebra',
        topo: [['i',0],[0,1],[1,2],[2,'t']],
        intro_hint: 'Vectors, matrices, decompositions — the geometry of features and models.',
        test_hint:  'Linear algebra checkpoint.',
        topics: [
          { id:'la_vec_mat', label:'Vectors & Matrices', hours: 14, hint:'Operations, rank, inverse, systems of equations.' },
          { id:'la_decomp',  label:'Decompositions',     hours: 12, hint:'LU, QR, SVD — the workhorses.' },
          { id:'la_eigen',   label:'Eigenvalues',        hours: 10, hint:'Eigenvectors, spectral theorem, diagonalization.' },
        ]},
      // topo: intro→Inference→Hypothesis Testing→test
      { id: 'stats', label: 'Statistics',
        topo: [['i',0],[0,1],[1,'t']],
        intro_hint: 'Sampling, estimators, the science of confidence.',
        test_hint:  'Statistics checkpoint.',
        topics: [
          { id:'st_infer', label:'Inference',          hours: 12, hint:'Sampling, estimators, confidence intervals.' },
          { id:'st_hyp',   label:'Hypothesis Testing', hours: 10, hint:'p-values, t-tests, multiple comparisons.' },
        ]},
      // topo: intro→Distributions→[Bayes,Markov] parallel→test
      { id: 'prob', label: 'Probability',
        topo: [['i',0],[0,1],[0,2],[1,'t'],[2,'t']],
        intro_hint: 'Random variables, distributions, Bayes — the language of uncertainty.',
        test_hint:  'Probability checkpoint.',
        topics: [
          { id:'pr_distrib', label:'Distributions',  hours: 10, hint:'Normal, Bernoulli, Poisson, Beta.' },
          { id:'pr_bayes',   label:'Bayes',          hours: 12, hint:'Prior, posterior, likelihood — the whole story.' },
          { id:'pr_markov',  label:'Markov Chains',  hours: 8,  hint:'States, transitions, stationarity.' },
        ]},
    ]
  },
  {
    id: 'data', label: 'Data',
    intro_hint: 'How data actually flows in a company. SQL, Pandas, dashboards — and the craft of looking before modeling.',
    test_hint:  'Data checkpoint. You can pull, clean, profile, and visualize a dataset end-to-end.',
    sub_deps: [['pydata','viz'],['pydata','data_skills']],
    subs: [
      // topo: intro→SELECT→Window→Performance→test (sequential)
      { id: 'sql', label: 'SQL',
        topo: [['i',0],[0,1],[1,2],[2,'t']],
        intro_hint: 'The lingua franca of data warehouses.',
        test_hint:  'SQL checkpoint.',
        topics: [
          { id:'sql_basics', label:'SELECT & Joins',     hours: 10, hint:'Filters, aggregates, INNER/LEFT joins.' },
          { id:'sql_window', label:'Window Functions',   hours: 8,  hint:'OVER, PARTITION BY, ranking, rolling.' },
          { id:'sql_perf',   label:'Performance',        hours: 6,  hint:'Indexes, query plans, EXPLAIN.' },
        ]},
      // topo: intro→NumPy→[Pandas,SciPy] parallel→test
      { id: 'pydata', label: 'Python Data',
        topo: [['i',0],[0,1],[0,2],[1,'t'],[2,'t']],
        intro_hint: 'NumPy, Pandas, SciPy — vectorized data work.',
        test_hint:  'Python data stack checkpoint.',
        topics: [
          { id:'numpy',  label:'NumPy',  hours: 12, hint:'ndarrays, vectorization, broadcasting.' },
          { id:'pandas', label:'Pandas', hours: 15, hint:'DataFrames, groupby, merge, time series.' },
          { id:'scipy',  label:'SciPy',  hours: 8,  hint:'Stats, linalg, signal, sparse — the toolbox.' },
        ]},
      // parallel: Matplotlib and Dashboards are independent
      { id: 'viz', label: 'Visualization',
        intro_hint: 'Make data speak. Charts and dashboards.',
        test_hint:  'Viz checkpoint.',
        topics: [
          { id:'viz_mpl',  label:'Matplotlib', hours: 8,  hint:'The base layer — every chart traces back here.' },
          { id:'viz_dash', label:'Dashboards', hours: 6,  hint:'Plotly, Streamlit, Dash — internal tools.' },
        ]},
      // topo: intro→[EDA,Cleaning] parallel→ETL→test
      { id: 'data_skills', label: 'Data Skills',
        topo: [['i',0],['i',1],[0,2],[1,2],[2,'t']],
        intro_hint: 'The craft of exploratory data analysis.',
        test_hint:  'Data craft checkpoint.',
        topics: [
          { id:'eda',      label:'EDA',           hours: 8,  hint:'Profile, sanity-check, story before model.' },
          { id:'cleaning', label:'Cleaning',      hours: 6,  hint:'Missing values, outliers, duplicates.' },
          { id:'etl',      label:'ETL & Pipelines',hours: 10, hint:'Batch jobs, dbt, Airflow basics.' },
        ]},
    ]
  },
  {
    id: 'classical', label: 'Classical ML',
    intro_hint: 'The sturdy, interpretable, almost-always-works toolbox: regressions, trees, ensembles, clustering.',
    test_hint:  'Classical ML checkpoint. You can baseline any problem in an afternoon.',
    sub_deps: [['preproc','supervised'],['preproc','unsup'],['supervised','ensembles'],['supervised','evaluation']],
    subs: [
      { id: 'preproc', label: 'Preprocessing',
        intro_hint: 'Designing the inputs before fitting anything.',
        test_hint:  'Preprocessing checkpoint.',
        topics: [
          { id:'feat_eng', label:'Feature Engineering', hours: 10, hint:'Designing the inputs that make models work.' },
          { id:'encoding', label:'Encoding',            hours: 6,  hint:'One-hot, target, ordinal, embeddings.' },
          { id:'scaling',  label:'Scaling',             hours: 4,  hint:'StandardScaler, MinMax, robust scaling.' },
        ]},
      // parallel: Feature Eng, Encoding, Scaling are independent steps
      { id: 'supervised', label: 'Supervised',
        // topo: intro→[Linear,Trees] two parallel chains; Linear→SVM, Trees→k-NN; SVM,k-NN→test
        topo: [['i',0],['i',1],[0,2],[1,3],[2,'t'],[3,'t']],
        intro_hint: 'Learn a function from labeled examples.',
        test_hint:  'Supervised checkpoint.',
        topics: [
          { id:'linear', label:'Linear / Logistic', hours: 12, hint:'Regression and classification with linear boundary.' },
          { id:'tree',   label:'Decision Trees',    hours: 8,  hint:'Splitting criteria, depth, pruning.' },
          { id:'svm',    label:'SVM',               hours: 10, hint:'Margins, kernels, RBF.' },
          { id:'knn',    label:'k-NN',              hours: 4,  hint:'Lazy learner, distance metrics.' },
        ]},
      // parallel: k-Means and PCA are independent
      { id: 'unsup', label: 'Unsupervised',
        intro_hint: 'Find structure with no labels.',
        test_hint:  'Unsupervised checkpoint.',
        topics: [
          { id:'kmeans', label:'k-Means', hours: 6,  hint:'Centroid clustering — fast, simple.' },
          { id:'pca',    label:'PCA',     hours: 8,  hint:'Dimensionality reduction via eigenvectors.' },
        ]},
      // topo: intro→RF→XGBoost→LightGBM→test (sequential)
      { id: 'ensembles', label: 'Ensembles',
        topo: [['i',0],[0,1],[1,2],[2,'t']],
        intro_hint: 'Many weak learners > one strong one.',
        test_hint:  'Ensembles checkpoint.',
        topics: [
          { id:'rf',       label:'Random Forest', hours: 8,  hint:'Bagging + trees = robust.' },
          { id:'xgboost',  label:'XGBoost',       hours: 10, hint:'Gradient boosting — the Kaggle workhorse.' },
          { id:'lightgbm', label:'LightGBM',      hours: 6,  hint:'Faster, leaf-wise growth.' },
        ]},
      // topo: intro→[CrossVal,Metrics] parallel→Tuning→test
      { id: 'evaluation', label: 'Evaluation',
        topo: [['i',0],['i',1],[0,2],[1,2],[2,'t']],
        intro_hint: 'Measure twice, ship once.',
        test_hint:  'Evaluation checkpoint.',
        topics: [
          { id:'cross_val', label:'Cross-Validation',     hours: 6,  hint:'k-fold, stratified, time-series splits.' },
          { id:'metrics',   label:'Metrics',              hours: 8,  hint:'ROC, PR, MAE — pick the right one.' },
          { id:'tuning',    label:'Hyperparameter Tuning',hours: 10, hint:'Grid, random, Bayesian (Optuna).' },
        ]},
    ]
  },
  {
    id: 'deep', label: 'Deep Learning',
    intro_hint: 'Stacked layers, gradient descent, vast scale. The frontier.',
    test_hint:  'Deep learning checkpoint. You can train, debug and serve a model end-to-end.',
    sub_deps: [['dl_found','frameworks'],['frameworks','cnn_cv'],['frameworks','rnn_seq'],['frameworks','nlp_basics'],['nlp_basics','llms']],
    subs: [
      // topo: intro→Backprop→Optimizers→Regularization→test (sequential)
      { id: 'dl_found', label: 'DL Foundations',
        topo: [['i',0],[0,1],[1,2],[2,'t']],
        intro_hint: 'Backprop, optimizers, regularization — the mechanics.',
        test_hint:  'DL foundations checkpoint.',
        topics: [
          { id:'backprop',   label:'Backpropagation', hours: 15, hint:'Chain rule meets compute graphs.' },
          { id:'optimizers', label:'Optimizers',      hours: 10, hint:'SGD, Adam, AdamW, learning rate schedules.' },
          { id:'reg_dl',     label:'Regularization',  hours: 8,  hint:'Dropout, BN, weight decay, augmentation.' },
        ]},
      // parallel: PyTorch and TensorFlow are independent ecosystems
      { id: 'frameworks', label: 'Frameworks',
        intro_hint: 'PyTorch and TensorFlow — the two ecosystems.',
        test_hint:  'Frameworks checkpoint.',
        topics: [
          { id:'pytorch',    label:'PyTorch',           hours: 20, hint:'Tensors, autograd, nn.Module, training loops.' },
          { id:'tensorflow', label:'TensorFlow / Keras',hours: 18, hint:'Graph mode, tf.data, deployment story.' },
        ]},
      // topo: intro→Convolutions→[Detection,Segmentation] parallel→test
      { id: 'cnn_cv', label: 'CNNs & Vision',
        topo: [['i',0],[0,1],[0,2],[1,'t'],[2,'t']],
        intro_hint: 'Convolutions, image models, detection and segmentation.',
        test_hint:  'Vision checkpoint.',
        topics: [
          { id:'convolutions', label:'Convolutions', hours: 12, hint:'Kernels, stride, padding, receptive fields.' },
          { id:'detection',    label:'Detection',    hours: 15, hint:'YOLO, Faster R-CNN, anchor-free heads.' },
          { id:'segmentation', label:'Segmentation', hours: 12, hint:'U-Net, Mask R-CNN, SAM.' },
        ]},
      // topo: intro→Transformer→Fine-Tuning→RAG→test (sequential)
      { id: 'llms', label: 'Transformers & LLMs',
        topo: [['i',0],[0,1],[1,2],[2,'t']],
        intro_hint: 'The architecture that ate AI, and how to actually use it.',
        test_hint:  'Transformers checkpoint.',
        topics: [
          { id:'transformer', label:'Transformer', hours: 20, hint:'Self-attention — the architecture that ate AI.' },
          { id:'fine_tuning', label:'Fine-Tuning', hours: 12, hint:'SFT, LoRA, QLoRA — adapting big models cheap.' },
          { id:'rag',         label:'RAG',         hours: 10, hint:'Retrieve, ground, generate — tame hallucinations.' },
        ]},
      // topo: intro→LSTM→Seq2Seq→test (sequential)
      { id: 'rnn_seq', label: 'Sequences',
        topo: [['i',0],[0,1],[1,'t']],
        intro_hint: 'Recurrent networks for time and text.',
        test_hint:  'Sequences checkpoint.',
        topics: [
          { id:'lstm_gru', label:'LSTM / GRU', hours: 10, hint:'Gates that finally let RNNs remember.' },
          { id:'seq2seq',  label:'Seq2Seq',    hours: 12, hint:'Encoder-decoder + attention.' },
        ]},
      // topo: intro→Embeddings→BERT→test (sequential)
      { id: 'nlp_basics', label: 'NLP Basics',
        topo: [['i',0],[0,1],[1,'t']],
        intro_hint: 'Tokenization, embeddings, the building blocks of language models.',
        test_hint:  'NLP basics checkpoint.',
        topics: [
          { id:'embeddings', label:'Embeddings', hours: 10, hint:'Word2Vec, GloVe, contextual representations.' },
          { id:'bert',       label:'BERT',       hours: 15, hint:'Masked LM, fine-tune for classification.' },
        ]},
    ]
  },
  {
    id: 'mlops', label: 'MLOps',
    intro_hint: 'How a model becomes a production system. Tracking, deployment, monitoring.',
    test_hint:  'MLOps checkpoint. You can take a notebook all the way to a 24/7 production service.',
    sub_deps: [['exp_track','deployment'],['cicd','deployment'],['deployment','monitoring']],
    subs: [
      { id: 'exp_track', label: 'Experiment Tracking',
        intro_hint: 'Reproducibility for ML.',
        test_hint:  'Tracking checkpoint.',
        topics: [
          { id:'mlflow', label:'MLflow',         hours: 6,  hint:'Track runs, params, artifacts.' },
          { id:'wandb',  label:'Weights & Biases',hours: 6, hint:'Dashboards, sweeps, reports.' },
          { id:'dvc',    label:'DVC',            hours: 5,  hint:'Data and model versioning via Git.' },
        ]},
      { id: 'cicd', label: 'CI/CD',
        intro_hint: 'Automate the path from commit to model.',
        test_hint:  'CI/CD checkpoint.',
        topics: [
          { id:'pipelines', label:'Pipelines',       hours: 12, hint:'Kubeflow, Vertex, Airflow for ML.' },
          { id:'registry',  label:'Model Registry',  hours: 6,  hint:'Versioned models, stages, lineage.' },
        ]},
      // topo: intro→Docker→Kubernetes→Serving→test (sequential)
      { id: 'deployment', label: 'Deployment',
        topo: [['i',0],[0,1],[1,2],[2,'t']],
        intro_hint: 'Ship the model where users can hit it.',
        test_hint:  'Deployment checkpoint.',
        topics: [
          { id:'docker_adv', label:'Docker',     hours: 10, hint:'Multi-stage builds, GPU images, slim layers.' },
          { id:'kubernetes', label:'Kubernetes', hours: 20, hint:'Pods, services, autoscaling, GPU scheduling.' },
          { id:'serving',    label:'Serving',    hours: 12, hint:'Triton, TorchServe, BentoML, FastAPI.' },
        ]},
      // topo: intro→Logging→Drift→test
      { id: 'monitoring', label: 'Monitoring',
        topo: [['i',0],[0,1],[1,'t']],
        intro_hint: 'Watch what shipped, catch what breaks.',
        test_hint:  'Monitoring checkpoint.',
        topics: [
          { id:'logging', label:'Logging',         hours: 6,  hint:'Inputs, outputs, latencies — what shipped, what broke.' },
          { id:'drift',   label:'Drift Detection', hours: 8,  hint:'Data drift, concept drift, alerting.' },
        ]},
    ]
  },
];

// ─── Tidy-tree layout — guarantees zero edge crossings ────────────────
const NODES = [];
const EDGES = [];

(function buildTree() {
  const L = LAYOUT;
  const cx = L.CENTER_X;

  // ── Helpers defined first so subWidth can call them ──────────────────

  // Longest-path distance from each topic TO test (Bellman-Ford, backwards).
  // depth=1 → directly feeds into test (closest to sub_test).
  // depth=N → furthest from test (closest to sub_intro).
  // Y position = subTestY + depth * VROW, so depth=1 is near the top.
  function topicDepths(s) {
    if (!s.topo) return s.topics.map(() => 1);
    const dist = {};
    // Seed: topics that connect directly to test
    s.topo.forEach(([from, to]) => {
      if (to === 't' && from !== 'i') dist[from] = Math.max(dist[from] || 0, 1);
    });
    // Relax backwards: if from→to in DAG, from is further from test
    let changed = true;
    while (changed) {
      changed = false;
      s.topo.forEach(([from, to]) => {
        if (from !== 'i' && to !== 't') {
          const nd = (dist[to] || 0) + 1;
          if (nd > (dist[from] || 0)) { dist[from] = nd; changed = true; }
        }
      });
    }
    return s.topics.map((_, i) => dist[i] || 1);
  }

  function subMaxDepth(s) { return Math.max(...topicDepths(s)); }

  // Width = space needed for the widest single depth-level in this subdomain.
  // A sequential chain of 4 nodes only needs 1-node width; a fork of 3 needs 3-node width.
  function subWidth(s) {
    const depths = topicDepths(s);
    const byDepth = {};
    depths.forEach(d => { byDepth[d] = (byDepth[d] || 0) + 1; });
    const maxAtLevel = Math.max(...Object.values(byDepth));
    return Math.max(L.MIN_SUB_W, (maxAtLevel - 1) * L.TOPIC_SPACING + 36);
  }

  function groupWidth(subs) {
    return subs.reduce((a, s, i) => a + subWidth(s) + (i > 0 ? L.SUB_GAP : 0), 0);
  }

  // Longest-path distance of each subdomain TO domain_test.
  // depth=1 → feeds directly into domain_test. Higher → closer to domain_intro.
  function subdomainDepths(dom) {
    if (!dom.sub_deps) return dom.subs.map(() => 1);
    const dm = {};
    dom.subs.forEach(s => { dm[s.id] = 1; });
    let changed = true;
    while (changed) {
      changed = false;
      dom.sub_deps.forEach(([from, to]) => {
        const nd = dm[to] + 1;
        if (nd > dm[from]) { dm[from] = nd; changed = true; }
      });
    }
    return dom.subs.map(s => dm[s.id]);
  }

  // Assign X positions within a subdomain using the barycenter heuristic.
  // For each depth level, topics are sorted by average parent X, then
  // distributed evenly around subCenter. This produces crossing-free layouts
  // for all the topology patterns we use.
  function assignTopicX(s, subCenter) {
    const depths = topicDepths(s);
    if (!s.topo) {
      // Parallel: spread all topics evenly
      const n = s.topics.length;
      return s.topics.map((_, i) =>
        subCenter - (n - 1) * L.TOPIC_SPACING / 2 + i * L.TOPIC_SPACING
      );
    }
    // Build parent lists: parentOf[topicIdx] = [parentIdx, ...] (-1 = intro)
    const parentOf = s.topics.map(() => []);
    s.topo.forEach(([from, to]) => {
      if (to !== 't') parentOf[to].push(from === 'i' ? -1 : from);
    });
    const maxDepth = Math.max(...depths);
    const byDepth = {};
    depths.forEach((d, i) => { (byDepth[d] = byDepth[d] || []).push(i); });
    const xPos = new Array(s.topics.length).fill(subCenter);
    // Process from intro side (high d) toward test (low d) so parents are placed first
    for (let d = maxDepth; d >= 1; d--) {
      const atLevel = [...(byDepth[d] || [])];
      // Sort by average parent X (barycenter)
      atLevel.sort((a, b) => {
        const avgX = tIdx => {
          const ps = parentOf[tIdx];
          if (!ps.length) return subCenter;
          return ps.map(p => p === -1 ? subCenter : xPos[p])
                   .reduce((s, v) => s + v, 0) / ps.length;
        };
        return avgX(a) - avgX(b);
      });
      // Distribute evenly around the average of parents' X positions
      const n = atLevel.length;
      const groupCenterX = atLevel.reduce((sum, ti) => {
        const ps = parentOf[ti];
        const px = !ps.length ? subCenter
          : ps.map(p => p === -1 ? subCenter : xPos[p]).reduce((s, v) => s + v, 0) / ps.length;
        return sum + px;
      }, 0) / n;
      atLevel.forEach((ti, j) => {
        xPos[ti] = groupCenterX - (n - 1) * L.TOPIC_SPACING / 2 + j * L.TOPIC_SPACING;
      });
    }
    return xPos;
  }

  // ml_engineer at top (y = TOP_MARGIN)
  let y = L.TOP_MARGIN;
  NODES.push({
    id: 'ml_engineer', type: 'root', kind: 'goal', tier: 'root',
    label: 'ML Engineer',
    tagline: 'You made it',
    color: ROOT_COLOR_GOAL,
    x: cx, y, depth: 0,
    hint: "You made it. Time to design systems, own incidents, and mentor the next one.",
  });

  let prevConnect = 'ml_engineer';

  // Iterate domains from goal (top) to start (bottom)
  for (let i = DOMAINS.length - 1; i >= 0; i--) {
    const dom = DOMAINS[i];
    const dColor = DOMAIN_COLORS[dom.id];

    // Compute subdomain depth levels (1 = closest to domain_test)
    const sDepths = subdomainDepths(dom);
    const maxSubDepth = Math.max(...sDepths);

    // Group subs by depth level
    const subsByLevel = {};
    dom.subs.forEach((s, idx) => {
      const lvl = sDepths[idx];
      (subsByLevel[lvl] = subsByLevel[lvl] || []).push(s);
    });

    // 1. domain_test row
    y += L.DOMAIN_GAP_V;
    const domTestId = `${dom.id}_test`;
    NODES.push({
      id: domTestId, type: 'gate', kind: 'test', tier: 'domain',
      label: dom.label, domain: dom.id, color: dColor,
      x: cx, y, depth: 1,
      hint: dom.test_hint,
      difficulty: DOMAIN_DIFFICULTY[dom.id],
      starThreshold: DOMAIN_THRESHOLD[dom.id],
    });
    EDGES.push([domTestId, prevConnect]);

    // Subs that feed into other subs — skip their direct edge to domain_test
    const hasDependents = new Set(dom.sub_deps ? dom.sub_deps.map(d => d[0]) : []);

    // 2. For each depth level (1 = near domain_test, maxSubDepth = near domain_intro)
    for (let lvl = 1; lvl <= maxSubDepth; lvl++) {
      const levelSubs = subsByLevel[lvl] || [];
      const levelW = groupWidth(levelSubs);
      const levelStartX = cx - levelW / 2;

      // Compute horizontal positions for subs at this level
      const subData = levelSubs.map((s, idx) => {
        const w = subWidth(s);
        const offset = levelSubs.slice(0, idx).reduce((a, ss) => a + subWidth(ss) + L.SUB_GAP, 0);
        return { ...s, width: w, center: levelStartX + offset + w / 2 };
      });

      // Max topic depth at this level (for centering shallower subs)
      const levelMaxDepth = Math.max(...subData.map(s => subMaxDepth(s)));

      // sub_test row
      y += L.VROW;
      const subTestY = y;
      subData.forEach(s => {
        NODES.push({
          id: `${s.id}_test`, type: 'gate', kind: 'test', tier: 'sub',
          label: s.label, domain: dom.id, sub: s.id, color: dColor,
          x: s.center, y: subTestY, depth: 2,
          hint: s.test_hint,
          difficulty: SUB_DIFFICULTY[s.id] || 2,
        });
        if (!hasDependents.has(s.id)) EDGES.push([`${s.id}_test`, domTestId]);
      });

      // topic nodes
      subData.forEach(s => {
        const depths = topicDepths(s);
        const xPositions = assignTopicX(s, s.center);
        const smd = subMaxDepth(s);
        const yOffset = (levelMaxDepth - smd) / 2;
        s.topics.forEach((topic, ti) => {
          NODES.push({
            id: topic.id, type: 'topic', tier: 'topic',
            label: topic.label, hint: topic.hint, hours: topic.hours,
            domain: dom.id, sub: s.id, color: dColor,
            x: xPositions[ti],
            y: subTestY + (depths[ti] + yOffset) * L.VROW,
            depth: 3,
          });
        });
      });

      // sub_intro row
      y = subTestY + (levelMaxDepth + 1) * L.VROW;
      const subIntroY = y;
      subData.forEach(s => {
        const subIntroId = `${s.id}_intro`;
        const subTestId  = `${s.id}_test`;
        NODES.push({
          id: subIntroId, type: 'gate', kind: 'intro', tier: 'sub',
          label: s.label, domain: dom.id, sub: s.id, color: dColor,
          x: s.center, y: subIntroY, depth: 2,
          hint: s.intro_hint,
        });

        if (s.topo) {
          const tid = idx => s.topics[idx].id;
          s.topo.forEach(([from, to]) => {
            const fromId = from === 'i' ? subIntroId : tid(from);
            const toId   = to   === 't' ? subTestId  : tid(to);
            EDGES.push([fromId, toId]);
          });
        } else {
          s.topics.forEach(topic => {
            EDGES.push([subIntroId, topic.id]);
            EDGES.push([topic.id, subTestId]);
          });
        }
      });
    }

    // 3. Inter-subdomain edges: prerequisite_test → dependent_intro
    if (dom.sub_deps) {
      dom.sub_deps.forEach(([from, to]) => {
        EDGES.push([`${from}_test`, `${to}_intro`]);
      });
    }

    // 4. domain_intro row
    y += L.VROW;
    const domIntroId = `${dom.id}_intro`;
    NODES.push({
      id: domIntroId, type: 'gate', kind: 'intro', tier: 'domain',
      label: dom.label, domain: dom.id, color: dColor,
      x: cx, y, depth: 1,
      hint: dom.intro_hint,
    });
    // Only connect domain_intro to "entry" subs (those with no prerequisites)
    const hasPrereq = new Set(dom.sub_deps ? dom.sub_deps.map(d => d[1]) : []);
    dom.subs.forEach(s => {
      if (!hasPrereq.has(s.id)) {
        EDGES.push([domIntroId, `${s.id}_intro`]);
      }
    });

    prevConnect = domIntroId;
  }

  // roadmap_intro at the very bottom
  y += L.DOMAIN_GAP_V;
  NODES.push({
    id: 'roadmap_intro', type: 'root', kind: 'start', tier: 'root',
    label: 'Start',
    tagline: 'Your journey begins',
    color: ROOT_COLOR_START,
    x: cx, y, depth: 0,
    hint: 'Your ML engineer journey starts here. Master each topic, pass each test, climb to the top.',
  });
  EDGES.push(['roadmap_intro', prevConnect]);

  LAYOUT.CANVAS_H = y + L.BOTTOM_MARGIN;
})();

// Adjacency (undirected for unlock logic)
const ADJ = {};
NODES.forEach(n => { ADJ[n.id] = new Set(); });
EDGES.forEach(([a, b]) => { ADJ[a].add(b); ADJ[b].add(a); });

const NODE_BY_ID = Object.fromEntries(NODES.map(n => [n.id, n]));
const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map(d => [d.id, d]));
const SUB_BY_ID = (() => {
  const out = {};
  DOMAINS.forEach(d => { d.subs.forEach(s => { out[s.id] = { ...s, domainId: d.id }; }); });
  return out;
})();

const START_ID = 'roadmap_intro';
const GOAL_ID  = 'ml_engineer';

Object.assign(window, {
  LAYOUT, DOMAINS, DOMAIN_COLORS,
  SUB_DIFFICULTY, DOMAIN_DIFFICULTY, DOMAIN_THRESHOLD,
  QUIZ_DATA,
  NODES, EDGES, ADJ,
  NODE_BY_ID, DOMAIN_BY_ID, SUB_BY_ID,
  START_ID, GOAL_ID,
});

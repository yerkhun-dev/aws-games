/* IAM Labyrinth — dependency-free visual IAM policy puzzle. */
(function () {
  "use strict";

  const STORAGE_KEY = "cloud-arcade:iam-labyrinth:stats";
  const script = document.currentScript;
  const STYLE_URL = script && script.src
    ? new URL("../../css/iam-labyrinth.css", script.src).href
    : "css/iam-labyrinth.css";
  const ACCOUNTS = { home: "111122223333", external: "444455556666" };
  const LAYERS = ["identity", "boundary", "scp", "resource", "trust"];
  const LAYER_NAMES = {
    identity: "Identity Policy", boundary: "Permissions Boundary", scp: "SCP",
    resource: "Resource Policy", trust: "Trust Policy"
  };
  const PATH = [
    ["principal", "Principal", "USR"], ["identity", "Identity Policy", "ID"],
    ["boundary", "Permissions Boundary", "PB"], ["scp", "SCP", "OU"],
    ["resource", "Resource / Trust Policy", "RP"], ["target", "Resource", "AWS"]
  ];

  let host = null;
  let exitCallback = null;
  let state = null;
  let ownedStyle = null;
  let clickHandler = null;
  let changeHandler = null;
  let keyHandler = null;
  let liveTimer = null;

  function statement(Sid, Effect, options) {
    return Object.assign({ Sid, Effect }, options);
  }

  function card(id, layer, title, code, statements, options) {
    return Object.assign({ id, layer, title, code, statements: Array.isArray(statements) ? statements : [statements], cost: 0, hint: "" }, options || {});
  }

  function request(id, label, action, resource, expected, options) {
    return Object.assign({ id, label, action, resource, expected, principal: `arn:aws:iam::${ACCOUNTS.home}:user/maze-player`, context: {} }, options || {});
  }

  const A = {
    s3Bucket: `arn:aws:s3:::labyrinth-docs`,
    s3Objects: `arn:aws:s3:::labyrinth-docs/*`,
    logsGroup: `arn:aws:logs:us-east-1:${ACCOUNTS.home}:log-group:/aws/lambda/maze-worker:*`,
    table: `arn:aws:dynamodb:us-east-1:${ACCOUNTS.home}:table/MazeItems`,
    tableOther: `arn:aws:dynamodb:us-east-1:${ACCOUNTS.home}:table/OtherItems`,
    function: `arn:aws:lambda:us-east-1:${ACCOUNTS.home}:function:maze-worker`,
    passRole: `arn:aws:iam::${ACCOUNTS.home}:role/application/maze-lambda-role`,
    adminRole: `arn:aws:iam::${ACCOUNTS.home}:role/AdminRole`,
    crossRole: `arn:aws:iam::${ACCOUNTS.external}:role/MazeAuditRole`,
    taggedBucket: `arn:aws:s3:::maze-production/report.csv`
  };

  const CHALLENGES = [
    {
      id: "s3-read", title: "S3 read-only", domain: "Storage", difficulty: 1,
      brief: "Permite listar el bucket y leer sus objetos. Ninguna escritura debe atravesar el laberinto.",
      lesson: "ListBucket usa el ARN del bucket; GetObject usa el ARN de objetos.",
      activeLayers: ["identity"], correct: ["s3-list", "s3-get"],
      cards: [
        card("s3-list", "identity", "Listar el bucket", "s3:ListBucket → labyrinth-docs", statement("ListBucket", "Allow", { Action: "s3:ListBucket", Resource: A.s3Bucket })),
        card("s3-get", "identity", "Leer objetos", "s3:GetObject → labyrinth-docs/*", statement("ReadObjects", "Allow", { Action: "s3:GetObject", Resource: A.s3Objects })),
        card("s3-all", "identity", "Control total de S3", "s3:* → *", statement("S3Admin", "Allow", { Action: "s3:*", Resource: "*" }), { cost: 5, hint: "Acciones y recursos excesivos" }),
        card("s3-wrong-arn", "identity", "GetObject en bucket", "s3:GetObject → labyrinth-docs", statement("WrongObjectArn", "Allow", { Action: "s3:GetObject", Resource: A.s3Bucket }))
      ],
      tests: [
        request("list", "Lista el bucket", "s3:ListBucket", A.s3Bucket, "Allow"),
        request("read", "Lee report.csv", "s3:GetObject", `${A.s3Bucket}/report.csv`, "Allow"),
        request("write", "Intenta subir malware.zip", "s3:PutObject", `${A.s3Bucket}/malware.zip`, "Deny", { leastPrivilege: true }),
        request("other", "Lee otro bucket", "s3:GetObject", "arn:aws:s3:::other-bucket/report.csv", "Deny", { leastPrivilege: true })
      ]
    },
    {
      id: "lambda-logs", title: "Lambda escribe logs", domain: "Observability", difficulty: 1,
      brief: "Da a maze-worker acceso de escritura solo a su grupo de CloudWatch Logs.",
      lesson: "Los permisos de escritura de logs se pueden limitar al ARN del log group ficticio.",
      activeLayers: ["identity"], correct: ["logs-write"],
      cards: [
        card("logs-write", "identity", "Escribir streams y eventos", "CreateLogStream + PutLogEvents", statement("WriteFunctionLogs", "Allow", { Action: ["logs:CreateLogStream", "logs:PutLogEvents"], Resource: A.logsGroup })),
        card("logs-read", "identity", "Leer todos los logs", "logs:Get* → *", statement("ReadEveryLog", "Allow", { Action: "logs:Get*", Resource: "*" }), { cost: 2, hint: "Lectura ajena al objetivo" }),
        card("logs-all", "identity", "Administrar Logs", "logs:* → *", statement("LogsAdmin", "Allow", { Action: "logs:*", Resource: "*" }), { cost: 5, hint: "Demasiado amplio" })
      ],
      tests: [
        request("stream", "Crea un log stream", "logs:CreateLogStream", A.logsGroup, "Allow"),
        request("events", "Publica eventos", "logs:PutLogEvents", A.logsGroup, "Allow"),
        request("delete", "Borra otro grupo", "logs:DeleteLogGroup", `arn:aws:logs:us-east-1:${ACCOUNTS.home}:log-group:/aws/lambda/other:*`, "Deny", { leastPrivilege: true })
      ]
    },
    {
      id: "ddb-item", title: "DynamoDB item access", domain: "Database", difficulty: 1,
      brief: "Permite leer y actualizar items de MazeItems, sin abrir otras tablas ni operaciones administrativas.",
      lesson: "Una tabla concreta y dos acciones bastan para este workload.",
      activeLayers: ["identity"], correct: ["ddb-items"],
      cards: [
        card("ddb-items", "identity", "Items de MazeItems", "GetItem + UpdateItem → MazeItems", statement("MazeItems", "Allow", { Action: ["dynamodb:GetItem", "dynamodb:UpdateItem"], Resource: A.table })),
        card("ddb-scan", "identity", "Escanear todas las tablas", "dynamodb:Scan → *", statement("ScanAll", "Allow", { Action: "dynamodb:Scan", Resource: "*" }), { cost: 3 }),
        card("ddb-all", "identity", "Todos los datos", "dynamodb:* → table/*", statement("AllTables", "Allow", { Action: "dynamodb:*", Resource: `arn:aws:dynamodb:us-east-1:${ACCOUNTS.home}:table/*` }), { cost: 5 })
      ],
      tests: [
        request("get", "Obtiene un item", "dynamodb:GetItem", A.table, "Allow"),
        request("update", "Actualiza un item", "dynamodb:UpdateItem", A.table, "Allow"),
        request("other", "Lee OtherItems", "dynamodb:GetItem", A.tableOther, "Deny", { leastPrivilege: true }),
        request("delete-table", "Borra MazeItems", "dynamodb:DeleteTable", A.table, "Deny", { leastPrivilege: true })
      ]
    },
    {
      id: "mfa", title: "Acceso condicionado por MFA", domain: "Identity", difficulty: 2,
      brief: "Permite detener una instancia de laboratorio solo cuando la sesión presenta MFA.",
      lesson: "Bool comprueba aws:MultiFactorAuthPresent; una Allow sin MFA ampliaría el acceso.",
      activeLayers: ["identity"], correct: ["mfa-stop"],
      cards: [
        card("mfa-stop", "identity", "StopInstances con MFA", "Bool MFA = true", statement("MfaStop", "Allow", { Action: "ec2:StopInstances", Resource: `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/i-maze001`, Condition: { Bool: { "aws:MultiFactorAuthPresent": "true" } } })),
        card("stop-open", "identity", "StopInstances sin condición", "Sin MFA", statement("OpenStop", "Allow", { Action: "ec2:StopInstances", Resource: `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/i-maze001` }), { cost: 4 })
      ],
      tests: [
        request("mfa-yes", "Sesión con MFA", "ec2:StopInstances", `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/i-maze001`, "Allow", { context: { "aws:MultiFactorAuthPresent": true } }),
        request("mfa-no", "Sesión sin MFA", "ec2:StopInstances", `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/i-maze001`, "Deny", { context: { "aws:MultiFactorAuthPresent": false }, leastPrivilege: true }),
        request("mfa-missing", "Clave MFA ausente", "ec2:StopInstances", `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/i-maze001`, "Deny", { leastPrivilege: true })
      ]
    },
    {
      id: "source-ip", title: "Perímetro por IP", domain: "Network", difficulty: 2,
      brief: "Permite descargar un objeto solo desde la red de oficina ficticia 203.0.113.0/24.",
      lesson: "IpAddress compara aws:SourceIp con un CIDR; una clave ausente no coincide.",
      activeLayers: ["identity"], correct: ["ip-read"],
      cards: [
        card("ip-read", "identity", "Leer desde oficina", "IpAddress 203.0.113.0/24", statement("OfficeRead", "Allow", { Action: "s3:GetObject", Resource: A.s3Objects, Condition: { IpAddress: { "aws:SourceIp": "203.0.113.0/24" } } })),
        card("ip-any", "identity", "Leer desde cualquier IP", "Sin condición", statement("AnywhereRead", "Allow", { Action: "s3:GetObject", Resource: A.s3Objects }), { cost: 4 })
      ],
      tests: [
        request("inside", "IP 203.0.113.42", "s3:GetObject", `${A.s3Bucket}/guide.pdf`, "Allow", { context: { "aws:SourceIp": "203.0.113.42" } }),
        request("outside", "IP 198.51.100.9", "s3:GetObject", `${A.s3Bucket}/guide.pdf`, "Deny", { context: { "aws:SourceIp": "198.51.100.9" }, leastPrivilege: true }),
        request("absent", "SourceIp ausente", "s3:GetObject", `${A.s3Bucket}/guide.pdf`, "Deny", { leastPrivilege: true })
      ]
    },
    {
      id: "resource-tags", title: "Etiquetas del recurso", domain: "Governance", difficulty: 2,
      brief: "Permite iniciar solo instancias etiquetadas Environment=Development.",
      lesson: "StringEquals sobre aws:ResourceTag/Environment limita la Allow al recurso etiquetado.",
      activeLayers: ["identity"], correct: ["tag-start"],
      cards: [
        card("tag-start", "identity", "Start en Development", "ResourceTag/Environment = Development", statement("DevStart", "Allow", { Action: "ec2:StartInstances", Resource: `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/*`, Condition: { StringEquals: { "aws:ResourceTag/Environment": "Development" } } })),
        card("tag-wild", "identity", "Start en cualquier etiqueta", "Environment = *", statement("AnyTag", "Allow", { Action: "ec2:StartInstances", Resource: `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/*`, Condition: { StringLike: { "aws:ResourceTag/Environment": "*" } } }), { cost: 3 })
      ],
      tests: [
        request("dev", "Instancia Development", "ec2:StartInstances", `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/i-dev001`, "Allow", { context: { "aws:ResourceTag/Environment": "Development" } }),
        request("prod", "Instancia Production", "ec2:StartInstances", `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/i-prod001`, "Deny", { context: { "aws:ResourceTag/Environment": "Production" }, leastPrivilege: true }),
        request("untagged", "Instancia sin etiqueta", "ec2:StartInstances", `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/i-none001`, "Deny", { leastPrivilege: true })
      ]
    },
    {
      id: "pass-role", title: "PassRole con alcance", domain: "Identity", difficulty: 3,
      brief: "Permite pasar solo maze-lambda-role y únicamente al servicio Lambda.",
      lesson: "iam:PassRole con Resource '*' puede habilitar escalada. Limita rol y iam:PassedToService.",
      activeLayers: ["identity"], correct: ["pass-scoped"],
      cards: [
        card("pass-scoped", "identity", "Pasar rol de Lambda", "Rol exacto + PassedToService", statement("PassMazeLambdaRole", "Allow", { Action: "iam:PassRole", Resource: A.passRole, Condition: { StringEquals: { "iam:PassedToService": "lambda.amazonaws.com" } } })),
        card("pass-any", "identity", "Pasar cualquier rol", "iam:PassRole → *", statement("PassAnyRole", "Allow", { Action: "iam:PassRole", Resource: "*" }), { cost: 8, hint: "Ruta de escalada de privilegios" }),
        card("pass-role-any-service", "identity", "Rol correcto, servicio libre", "Rol exacto sin condición", statement("PassRoleAnyService", "Allow", { Action: "iam:PassRole", Resource: A.passRole }), { cost: 4 })
      ],
      tests: [
        request("lambda", "Pasa maze-lambda-role a Lambda", "iam:PassRole", A.passRole, "Allow", { context: { "iam:PassedToService": "lambda.amazonaws.com" } }),
        request("ec2", "Pasa el rol a EC2", "iam:PassRole", A.passRole, "Deny", { context: { "iam:PassedToService": "ec2.amazonaws.com" }, leastPrivilege: true }),
        request("admin", "Pasa AdminRole", "iam:PassRole", A.adminRole, "Deny", { context: { "iam:PassedToService": "lambda.amazonaws.com" }, leastPrivilege: true })
      ]
    },
    {
      id: "cross-account-trust", title: "AssumeRole entre cuentas", domain: "STS", difficulty: 3,
      brief: "El usuario ficticio de 111122223333 necesita asumir MazeAuditRole en 444455556666. Completa ambos lados.",
      lesson: "AssumeRole requiere permiso de identidad del caller y confianza del rol destino.",
      activeLayers: ["identity", "trust"], correct: ["assume-identity", "assume-trust"],
      cards: [
        card("assume-identity", "identity", "Permiso para asumir el rol", "sts:AssumeRole → MazeAuditRole", statement("AssumeAudit", "Allow", { Action: "sts:AssumeRole", Resource: A.crossRole })),
        card("assume-trust", "trust", "Confianza en el usuario", "Principal maze-player", statement("TrustMazePlayer", "Allow", { Action: "sts:AssumeRole", Principal: { AWS: `arn:aws:iam::${ACCOUNTS.home}:user/maze-player` } })),
        card("trust-account", "trust", "Confianza amplia en la cuenta", `Principal ${ACCOUNTS.home}:root`, statement("TrustWholeAccount", "Allow", { Action: "sts:AssumeRole", Principal: { AWS: `arn:aws:iam::${ACCOUNTS.home}:root` } }), { cost: 4 }),
        card("assume-any", "identity", "Asumir cualquier rol", "sts:AssumeRole → *", statement("AssumeAny", "Allow", { Action: "sts:AssumeRole", Resource: "*" }), { cost: 5 })
      ],
      tests: [
        request("trusted", "maze-player asume MazeAuditRole", "sts:AssumeRole", A.crossRole, "Allow"),
        request("other-role", "Asume otro rol externo", "sts:AssumeRole", `arn:aws:iam::${ACCOUNTS.external}:role/OtherRole`, "Deny", { leastPrivilege: true }),
        request("other-user", "intruder intenta asumirlo", "sts:AssumeRole", A.crossRole, "Deny", { principal: `arn:aws:iam::${ACCOUNTS.home}:user/intruder`, leastPrivilege: true })
      ]
    },
    {
      id: "explicit-deny", title: "El muro de Explicit Deny", domain: "Evaluation", difficulty: 3,
      brief: "Da acceso amplio de lectura S3, pero bloquea secrets.txt aunque otra Allow coincida.",
      lesson: "Un Explicit Deny aplicable gana frente a cualquier Allow.",
      activeLayers: ["identity"], correct: ["read-all", "deny-secret"],
      cards: [
        card("read-all", "identity", "Leer objetos del bucket", "s3:GetObject → labyrinth-docs/*", statement("ReadBucket", "Allow", { Action: "s3:GetObject", Resource: A.s3Objects })),
        card("deny-secret", "identity", "Denegar secrets.txt", "Deny GetObject → secrets.txt", statement("ProtectSecret", "Deny", { Action: "s3:GetObject", Resource: `${A.s3Bucket}/secrets.txt` })),
        card("allow-secret", "identity", "Allow adicional a secrets", "Allow secrets.txt", statement("ExtraSecretAllow", "Allow", { Action: "s3:GetObject", Resource: `${A.s3Bucket}/secrets.txt` }), { cost: 2 }),
        card("not-delete", "identity", "Todo excepto DeleteObject", "NotAction s3:DeleteObject → *", statement("DangerousNotAction", "Allow", { NotAction: "s3:DeleteObject", Resource: "*" }), { cost: 8, hint: "NotAction concede casi todo" })
      ],
      tests: [
        request("public", "Lee public.txt", "s3:GetObject", `${A.s3Bucket}/public.txt`, "Allow"),
        request("secret", "Lee secrets.txt", "s3:GetObject", `${A.s3Bucket}/secrets.txt`, "Deny"),
        request("write", "Sube un objeto", "s3:PutObject", `${A.s3Bucket}/new.txt`, "Deny", { leastPrivilege: true })
      ]
    },
    {
      id: "boundary", title: "Permissions Boundary", domain: "Guardrail", difficulty: 3,
      brief: "La identidad pide s3:*, pero su boundary solo debe dejar pasar lectura de labyrinth-docs.",
      lesson: "Una permissions boundary limita permisos de identidad. Por sí sola no concede acceso.",
      activeLayers: ["identity", "boundary"], correct: ["identity-s3-all", "boundary-read"],
      cards: [
        card("identity-s3-all", "identity", "Policy de identidad amplia", "Allow s3:*", statement("IdentityS3", "Allow", { Action: "s3:*", Resource: "*" }), { cost: 2, hint: "La boundary contiene esta policy, pero sigue siendo más amplia de lo ideal" }),
        card("boundary-read", "boundary", "Boundary de lectura", "GetObject + ListBucket", [
          statement("BoundaryList", "Allow", { Action: "s3:ListBucket", Resource: A.s3Bucket }),
          statement("BoundaryRead", "Allow", { Action: "s3:GetObject", Resource: A.s3Objects })
        ]),
        card("boundary-all", "boundary", "Boundary sin límite", "Allow *", statement("BoundaryAll", "Allow", { Action: "*", Resource: "*" }), { cost: 5 })
      ],
      tests: [
        request("read", "Lee un objeto", "s3:GetObject", `${A.s3Bucket}/manual.pdf`, "Allow"),
        request("list", "Lista el bucket", "s3:ListBucket", A.s3Bucket, "Allow"),
        request("put", "Intenta escribir", "s3:PutObject", `${A.s3Bucket}/new.txt`, "Deny", { leastPrivilege: true }),
        request("iam", "Intenta crear un usuario", "iam:CreateUser", "*", "Deny", { leastPrivilege: true })
      ]
    },
    {
      id: "scp", title: "SCP de organización", domain: "Organizations", difficulty: 3,
      brief: "La identidad administra la función, pero el SCP debe limitar el conjunto efectivo a lectura e invocación.",
      lesson: "Un SCP fija el máximo disponible en cuentas miembro. No concede permisos a la identidad.",
      activeLayers: ["identity", "scp"], correct: ["lambda-admin-id", "scp-runtime"],
      cards: [
        card("lambda-admin-id", "identity", "Policy Lambda de identidad", "lambda:* → maze-worker", statement("LambdaIdentity", "Allow", { Action: "lambda:*", Resource: A.function }), { cost: 2 }),
        card("scp-runtime", "scp", "SCP de runtime", "GetFunction + InvokeFunction", statement("RuntimeCeiling", "Allow", { Action: ["lambda:GetFunction", "lambda:InvokeFunction"], Resource: A.function })),
        card("scp-all", "scp", "SCP FullAWSAccess", "Allow *", statement("FullCeiling", "Allow", { Action: "*", Resource: "*" }), { cost: 5 })
      ],
      tests: [
        request("get", "Consulta la función", "lambda:GetFunction", A.function, "Allow"),
        request("invoke", "Invoca maze-worker", "lambda:InvokeFunction", A.function, "Allow"),
        request("delete", "Intenta borrar maze-worker", "lambda:DeleteFunction", A.function, "Deny", { leastPrivilege: true }),
        request("other", "Invoca otra función", "lambda:InvokeFunction", `arn:aws:lambda:us-east-1:${ACCOUNTS.home}:function:other`, "Deny", { leastPrivilege: true })
      ]
    },
    {
      id: "forall-null", title: "ForAllValues y Null", domain: "Conditions", difficulty: 4,
      brief: "Permite CreateTags solo si todas las claves solicitadas son Project o Environment, y exige que aws:TagKeys exista.",
      lesson: "ForAllValues resulta true si la clave está ausente. Null=false en la misma clave evita esa verdad vacía.",
      activeLayers: ["identity"], correct: ["forall-guarded"],
      cards: [
        card("forall-only", "identity", "Allowlist sin guard", "ForAllValues:StringEquals", statement("VacuousAllow", "Allow", { Action: "ec2:CreateTags", Resource: `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/*`, Condition: { "ForAllValues:StringEquals": { "aws:TagKeys": ["Project", "Environment"] } } }), { cost: 4, hint: "La clave ausente satisface ForAllValues" }),
        card("forall-guarded", "identity", "Allowlist con Null guard", "ForAllValues + Null=false", statement("GuardedTagKeys", "Allow", { Action: "ec2:CreateTags", Resource: `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/*`, Condition: { "ForAllValues:StringEquals": { "aws:TagKeys": ["Project", "Environment"] }, Null: { "aws:TagKeys": "false" } } })),
        card("tag-all", "identity", "Crear cualquier etiqueta", "CreateTags sin condición", statement("AnyTags", "Allow", { Action: "ec2:CreateTags", Resource: "*" }), { cost: 6 })
      ],
      tests: [
        request("approved", "Claves Project y Environment", "ec2:CreateTags", `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/i-maze001`, "Allow", { context: { "aws:TagKeys": ["Project", "Environment"] } }),
        request("one", "Solo clave Project", "ec2:CreateTags", `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/i-maze001`, "Allow", { context: { "aws:TagKeys": ["Project"] } }),
        request("forbidden", "Incluye clave Owner", "ec2:CreateTags", `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/i-maze001`, "Deny", { context: { "aws:TagKeys": ["Project", "Owner"] }, leastPrivilege: true }),
        request("missing", "aws:TagKeys ausente", "ec2:CreateTags", `arn:aws:ec2:us-east-1:${ACCOUNTS.home}:instance/i-maze001`, "Deny", { leastPrivilege: true })
      ]
    },
    {
      id: "resource-policy", title: "Resource Policy", domain: "Cross-account", difficulty: 4,
      brief: "Un lector externo necesita GetObject. Exige tanto su permiso de identidad como la resource policy del bucket.",
      lesson: "En este acceso cross-account, una Allow debe existir en la cuenta del principal y en la policy del recurso.",
      activeLayers: ["identity", "resource"], correct: ["external-id", "bucket-policy"],
      cards: [
        card("external-id", "identity", "Policy del lector externo", "GetObject → shared/*", statement("ExternalIdentity", "Allow", { Action: "s3:GetObject", Resource: `arn:aws:s3:::maze-shared/*` })),
        card("bucket-policy", "resource", "Bucket policy para AuditReader", "Principal externo exacto", statement("ShareWithAuditReader", "Allow", { Action: "s3:GetObject", Resource: `arn:aws:s3:::maze-shared/*`, Principal: { AWS: `arn:aws:iam::${ACCOUNTS.external}:role/AuditReader` } })),
        card("bucket-public", "resource", "Bucket policy pública", "Principal *", statement("PublicRead", "Allow", { Action: "s3:GetObject", Resource: `arn:aws:s3:::maze-shared/*`, Principal: "*" }), { cost: 8 }),
        card("external-all", "identity", "Identidad con S3 total", "s3:* → *", statement("ExternalS3Admin", "Allow", { Action: "s3:*", Resource: "*" }), { cost: 5 })
      ],
      tests: [
        request("audit", "AuditReader lee evidence.json", "s3:GetObject", `arn:aws:s3:::maze-shared/evidence.json`, "Allow", { principal: `arn:aws:iam::${ACCOUNTS.external}:role/AuditReader`, requireResourcePolicy: true }),
        request("intruder", "Otra identidad externa lee", "s3:GetObject", `arn:aws:s3:::maze-shared/evidence.json`, "Deny", { principal: `arn:aws:iam::${ACCOUNTS.external}:role/Intruder`, requireResourcePolicy: true, leastPrivilege: true }),
        request("write", "AuditReader intenta escribir", "s3:PutObject", `arn:aws:s3:::maze-shared/new.json`, "Deny", { principal: `arn:aws:iam::${ACCOUNTS.external}:role/AuditReader`, requireResourcePolicy: true, leastPrivilege: true })
      ]
    },
    {
      id: "not-resource", title: "NotResource controlado", domain: "Evaluation", difficulty: 4,
      brief: "Permite borrar objetos de public/*, pero protege explícitamente todos los demás objetos del bucket.",
      lesson: "NotResource invierte la coincidencia: el Deny se aplica a todo objeto que no pertenezca a public/*.",
      activeLayers: ["identity"], correct: ["public-read", "delete-docs", "deny-delete-notresource"],
      cards: [
        card("public-read", "identity", "Leer public/*", "GetObject → public/*", statement("ReadPublic", "Allow", { Action: "s3:GetObject", Resource: `${A.s3Bucket}/public/*` })),
        card("delete-docs", "identity", "Borrar objetos del bucket", "DeleteObject → labyrinth-docs/*", statement("DeleteDocs", "Allow", { Action: "s3:DeleteObject", Resource: A.s3Objects })),
        card("deny-delete-notresource", "identity", "Deny borrado fuera de public", "NotResource public/*", statement("ProtectNonPublic", "Deny", { Action: "s3:DeleteObject", NotResource: `${A.s3Bucket}/public/*` })),
        card("delete-all", "identity", "Permitir borrado global", "DeleteObject → *", statement("DeleteEverywhere", "Allow", { Action: "s3:DeleteObject", Resource: "*" }), { cost: 7 })
      ],
      tests: [
        request("read-public", "Lee public/readme.txt", "s3:GetObject", `${A.s3Bucket}/public/readme.txt`, "Allow"),
        request("read-private", "Lee private/data.txt", "s3:GetObject", `${A.s3Bucket}/private/data.txt`, "Deny", { leastPrivilege: true }),
        request("delete-private", "Intenta borrar private/data.txt", "s3:DeleteObject", `${A.s3Bucket}/private/data.txt`, "Deny"),
        request("delete-public", "Borra public/readme.txt", "s3:DeleteObject", `${A.s3Bucket}/public/readme.txt`, "Allow"),
        request("delete-other", "Intenta borrar en otro bucket", "s3:DeleteObject", "arn:aws:s3:::other-bucket/file.txt", "Deny", { leastPrivilege: true })
      ]
    }
  ];

  function wildcardMatch(pattern, value, ignoreCase) {
    const escaped = String(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp(`^${escaped}$`, ignoreCase ? "i" : "").test(String(value));
  }

  function list(value) { return Array.isArray(value) ? value : [value]; }
  function hasKey(object, key) { return Object.prototype.hasOwnProperty.call(object || {}, key); }

  function ipToInt(ip) {
    const parts = String(ip).split(".");
    if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
    return parts.reduce((total, part) => (total * 256 + Number(part)) >>> 0, 0) >>> 0;
  }

  function inCidr(ip, cidr) {
    const bits = String(cidr).split("/");
    const address = ipToInt(ip);
    const network = ipToInt(bits[0]);
    const prefix = bits.length === 1 ? 32 : Number(bits[1]);
    if (address === null || network === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (address & mask) === (network & mask);
  }

  function conditionValueMatches(operator, actual, expected) {
    const actualValues = list(actual);
    const expectedValues = list(expected);
    if (operator === "StringEquals") return actualValues.some((a) => expectedValues.some((e) => String(a) === String(e)));
    if (operator === "StringLike") return actualValues.some((a) => expectedValues.some((e) => wildcardMatch(e, a)));
    if (operator === "Bool") return actualValues.some((a) => expectedValues.some((e) => String(a).toLowerCase() === String(e).toLowerCase()));
    if (operator === "IpAddress") return actualValues.some((a) => expectedValues.some((e) => inCidr(a, e)));
    return false;
  }

  function conditionsMatch(conditions, context) {
    if (!conditions) return true;
    return Object.entries(conditions).every(([rawOperator, entries]) => {
      const forAll = rawOperator.indexOf("ForAllValues:") === 0;
      const operator = forAll ? rawOperator.slice(13) : rawOperator;
      return Object.entries(entries).every(([key, expected]) => {
        const present = hasKey(context, key) && context[key] !== null;
        if (operator === "Null") {
          const isNull = !present;
          return list(expected).some((value) => String(isNull) === String(value).toLowerCase());
        }
        if (forAll) {
          if (!present || list(context[key]).length === 0) return true;
          return list(context[key]).every((actual) => conditionValueMatches(operator, actual, expected));
        }
        if (!present) return false;
        return conditionValueMatches(operator, context[key], expected);
      });
    });
  }

  function fieldMatches(statementValue, requestValue, ignoreCase) {
    return list(statementValue).some((pattern) => wildcardMatch(pattern, requestValue, ignoreCase));
  }

  function principalPatternMatches(pattern, requestPrincipal) {
    if (pattern === "*") return true;
    const accountRoot = String(pattern).match(/^arn:aws:iam::(\d{12}):root$/);
    if (accountRoot) return String(requestPrincipal).startsWith(`arn:aws:iam::${accountRoot[1]}:`);
    return wildcardMatch(pattern, requestPrincipal, false);
  }

  function principalMatches(principal, requestPrincipal) {
    if (principal == null) return true;
    if (principal === "*") return true;
    if (typeof principal === "object") return Object.values(principal).some((value) => list(value).some((pattern) => principalPatternMatches(pattern, requestPrincipal)));
    return principalPatternMatches(principal, requestPrincipal);
  }

  function statementMatches(item, req, layer) {
    const actionMatch = item.Action !== undefined ? fieldMatches(item.Action, req.action, true)
      : item.NotAction !== undefined ? !fieldMatches(item.NotAction, req.action, true) : false;
    const resourceMatch = item.Resource !== undefined ? fieldMatches(item.Resource, req.resource, false)
      : item.NotResource !== undefined ? !fieldMatches(item.NotResource, req.resource, false) : true;
    const needsPrincipal = layer === "resource" || layer === "trust";
    return actionMatch && resourceMatch && (!needsPrincipal || principalMatches(item.Principal, req.principal)) && conditionsMatch(item.Condition, req.context || {});
  }

  function evaluate(req, selectedCards, challenge) {
    const byLayer = Object.fromEntries(LAYERS.map((layer) => [layer, []]));
    selectedCards.forEach((entry) => entry.statements.forEach((item) => byLayer[entry.layer].push({ item, card: entry })));
    const matches = [];
    LAYERS.forEach((layer) => byLayer[layer].forEach((entry) => {
      if (statementMatches(entry.item, req, layer)) matches.push({ layer, sid: entry.item.Sid || "(sin Sid)", effect: entry.item.Effect, cardId: entry.card.id });
    }));
    const denies = matches.filter((match) => match.effect === "Deny");
    const allows = (layer) => matches.some((match) => match.layer === layer && match.effect === "Allow");
    let decision = "Deny";
    let reason = "No hay una Allow de identidad aplicable";
    let limitingLayer = "identity";

    if (denies.length) {
      reason = `Explicit Deny en ${LAYERS.find((layer) => denies.some((item) => item.layer === layer)) || "policy"}`;
      limitingLayer = denies[0].layer;
    } else if (req.action.toLowerCase() === "sts:assumerole") {
      if (!allows("identity")) {
        reason = "Falta Allow de identidad para sts:AssumeRole";
      } else if (!allows("trust")) {
        reason = "La trust policy no confía en este principal";
        limitingLayer = "trust";
      } else if (challenge.activeLayers.includes("boundary") && !allows("boundary")) {
        reason = "La permissions boundary no incluye la solicitud";
        limitingLayer = "boundary";
      } else if (challenge.activeLayers.includes("scp") && !allows("scp")) {
        reason = "El SCP no incluye la solicitud en su máximo permitido";
        limitingLayer = "scp";
      } else {
        decision = "Allow"; reason = "Identity Policy y Trust Policy coinciden"; limitingLayer = null;
      }
    } else {
      const identityAllowed = allows("identity");
      const resourceAllowed = allows("resource");
      if (!identityAllowed && !(resourceAllowed && !req.requireResourcePolicy)) {
        reason = "Falta una Allow de identidad aplicable";
      } else if (req.requireResourcePolicy && !resourceAllowed) {
        reason = "Falta una Allow en la resource policy para acceso cross-account";
        limitingLayer = "resource";
      } else if (challenge.activeLayers.includes("boundary") && !allows("boundary")) {
        reason = "La permissions boundary limita esta solicitud";
        limitingLayer = "boundary";
      } else if (challenge.activeLayers.includes("scp") && !allows("scp")) {
        reason = "El SCP limita esta solicitud";
        limitingLayer = "scp";
      } else {
        decision = "Allow";
        reason = resourceAllowed && !identityAllowed ? "La resource policy concede acceso" : "La Allow efectiva atraviesa todas las capas";
        limitingLayer = null;
      }
    }
    return { decision, reason, limitingLayer, matches };
  }

  function defaultStats() {
    return { played: 0, wins: 0, bestScore: 0, totalScore: 0, stars: 0, campaignProgress: 0, solved: {}, daily: {}, lastPlayed: "" };
  }

  function finite(value, fallback) { return Number.isFinite(value) && value >= 0 ? value : fallback; }

  function readStats() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const value = raw && typeof raw === "object" ? raw : {};
      return {
        played: finite(value.played, 0), wins: finite(value.wins, 0), bestScore: finite(value.bestScore, 0),
        totalScore: finite(value.totalScore, 0), stars: finite(value.stars, 0),
        campaignProgress: Math.min(CHALLENGES.length, finite(value.campaignProgress, 0)),
        solved: value.solved && typeof value.solved === "object" ? Object.assign({}, value.solved) : {},
        daily: value.daily && typeof value.daily === "object" ? Object.assign({}, value.daily) : {},
        lastPlayed: typeof value.lastPlayed === "string" ? value.lastPlayed : ""
      };
    } catch (_) { return defaultStats(); }
  }

  function saveStats(stats) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) { /* Storage is optional. */ }
  }

  function hash32(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }

  function seededShuffle(values, seed) {
    const copy = values.slice();
    let value = seed >>> 0;
    function random() {
      value += 0x6D2B79F5;
      let result = value;
      result = Math.imul(result ^ result >>> 15, result | 1);
      result ^= result + Math.imul(result ^ result >>> 7, result | 61);
      return ((result ^ result >>> 14) >>> 0) / 4294967296;
    }
    for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }

  function utcDateKey(date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`; }
  function dayNumber(key) { const p = key.split("-").map(Number); return Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); }

  function dailyChallenge(key) {
    const offset = dayNumber(key) - dayNumber("2025-01-01");
    const cycle = Math.floor(offset / CHALLENGES.length);
    const position = ((offset % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length;
    const order = seededShuffle(CHALLENGES, hash32(`iam-labyrinth:${cycle}`));
    if (cycle !== 0 && order.length > 1) {
      const previous = seededShuffle(CHALLENGES, hash32(`iam-labyrinth:${cycle - 1}`));
      if (previous[previous.length - 1].id === order[0].id) [order[0], order[1]] = [order[1], order[0]];
    }
    return order[position];
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function ensureStyles() {
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find((link) => link.href === STYLE_URL || link.dataset.iamLabyrinthStyle !== undefined);
    if (existing) return;
    ownedStyle = document.createElement("link");
    ownedStyle.rel = "stylesheet"; ownedStyle.href = STYLE_URL; ownedStyle.dataset.iamLabyrinthStyle = "";
    document.head.appendChild(ownedStyle);
  }

  function selectedCards() {
    const challenge = currentChallenge();
    return challenge ? challenge.cards.filter((item) => state.selected.has(item.id)) : [];
  }

  function currentChallenge() { return state ? CHALLENGES.find((item) => item.id === state.challengeId) || CHALLENGES[0] : null; }

  function newGame(mode, challenge) {
    state = {
      screen: "game", mode, challengeId: challenge.id, selected: new Set(), results: null,
      completed: false, score: 0, earnedStars: 0, attempts: 0, previewOpen: false,
      statsCommitted: false, playedCommitted: false,
      today: utcDateKey(new Date()), focusTest: 0
    };
  }

  function modeScreen() {
    const stats = readStats();
    return `<section class="iaml-picker" aria-labelledby="iaml-picker-title">
      <span class="iaml-eyebrow">POLICY EVALUATION LAB</span><h2 id="iaml-picker-title">Elige tu ruta</h2>
      <p>Construye policies, ejecuta solicitudes y observa dónde se permite o bloquea cada paso.</p>
      <div class="iaml-mode-grid">
        <button type="button" data-iaml-mode="campaign"><span>⌁</span><strong>Campaign</strong><small>${CHALLENGES.length} desafíos ordenados · progreso persistente</small><b>${Math.min(stats.campaignProgress, CHALLENGES.length)}/${CHALLENGES.length}</b></button>
        <button type="button" data-iaml-mode="daily"><span>◫</span><strong>Daily</strong><small>Rotación determinista sin repetir durante el catálogo</small><b>${escapeHtml(utcDateKey(new Date()))}</b></button>
        <button type="button" data-iaml-mode="sandbox"><span>{ }</span><strong>Practice / Policy Sandbox</strong><small>Abre cualquier escenario y prueba fragmentos libremente</small><b>LIBRE</b></button>
      </div>
      <div class="iaml-picker-stats"><span><b>${stats.played}</b><small>INTENTOS</small></span><span><b>${stats.wins}</b><small>RESUELTOS</small></span><span><b>${stats.stars}</b><small>ESTRELLAS</small></span><span><b>${stats.bestScore}</b><small>MEJOR SCORE</small></span></div>
      <button type="button" class="iaml-text" data-iaml-action="exit">← Volver al centro</button>
    </section>`;
  }

  function challengePicker(mode) {
    const stats = readStats();
    return `<section class="iaml-picker iaml-challenge-picker" aria-labelledby="iaml-challenges-title">
      <span class="iaml-eyebrow">${mode === "campaign" ? "CAMPAIGN MAP" : "POLICY SANDBOX"}</span><h2 id="iaml-challenges-title">Selecciona un desafío</h2>
      <p>${mode === "campaign" ? "La campaña recomienda avanzar en orden, pero el laboratorio permite revisar cualquier nivel." : "Las pruebas no bloquean el catálogo. Experimenta con todas las capas."}</p>
      <div class="iaml-challenge-grid">${CHALLENGES.map((challenge, index) => {
        const solved = stats.solved[challenge.id];
        const recommended = index === Math.min(stats.campaignProgress, CHALLENGES.length - 1);
        return `<button type="button" data-iaml-challenge="${challenge.id}" data-mode="${mode}" class="${solved ? "is-solved" : ""} ${recommended && mode === "campaign" ? "is-current" : ""}"><span>${String(index + 1).padStart(2, "0")}</span><div><small>${escapeHtml(challenge.domain)} · ${"◆".repeat(challenge.difficulty)}</small><strong>${escapeHtml(challenge.title)}</strong><em>${escapeHtml(challenge.brief)}</em></div><b>${solved ? `${solved.stars || 1}★` : "→"}</b></button>`;
      }).join("")}</div>
      <button type="button" class="iaml-text" data-iaml-action="modes">← Cambiar modo</button>
    </section>`;
  }

  function policyDocument(layer) {
    const cards = selectedCards().filter((item) => item.layer === layer);
    return { Version: "2012-10-17", Statement: cards.flatMap((item) => item.statements) };
  }

  function pathMarkup(challenge) {
    const resultLayers = state.results ? Object.fromEntries(LAYERS.map((layer) => [layer, state.results.some((r) => r.evaluation.limitingLayer === layer && r.actual !== r.test.expected) ? "bad" : state.results.some((r) => r.evaluation.matches.some((m) => m.layer === layer)) ? "good" : "idle"])) : {};
    return `<div class="iaml-path" role="img" aria-label="Ruta de evaluación desde Principal hasta Resource">${PATH.map((node, index) => {
      const active = node[0] === "principal" || node[0] === "target" || (node[0] === "resource" ? challenge.activeLayers.some((l) => l === "resource" || l === "trust") : challenge.activeLayers.includes(node[0]));
      const status = resultLayers[node[0]] || "idle";
      return `${index ? '<i aria-hidden="true">→</i>' : ""}<div class="${active ? "is-active" : "is-muted"} is-${status}"><span>${node[2]}</span><strong>${node[1]}</strong><small>${active ? (status === "good" ? "MATCH" : status === "bad" ? "BLOCK" : "EVALUATE") : "N/A"}</small></div>`;
    }).join("")}</div>`;
  }

  function cardMarkup(item) {
    const selected = state.selected.has(item.id);
    return `<button type="button" class="iaml-card ${selected ? "is-selected" : ""} ${item.cost ? "is-risky" : ""}" data-iaml-card="${item.id}" aria-pressed="${selected}">
      <span class="iaml-check" aria-hidden="true">${selected ? "✓" : "+"}</span><span><small>${escapeHtml(LAYER_NAMES[item.layer])}${item.cost ? ` · RIESGO +${item.cost}` : ""}</small><strong>${escapeHtml(item.title)}</strong><code>${escapeHtml(item.code)}</code>${item.hint ? `<em>${escapeHtml(item.hint)}</em>` : ""}</span>
    </button>`;
  }

  function resultsMarkup() {
    if (!state.results) return `<div class="iaml-empty-results"><span>▷</span><strong>Suite sin ejecutar</strong><p>Selecciona fragmentos y ejecuta todas las solicitudes.</p></div>`;
    return `<div class="iaml-results-list" role="list">${state.results.map((result, index) => {
      const pass = result.actual === result.test.expected;
      const matched = result.evaluation.matches.length ? result.evaluation.matches.map((m) => `${m.effect} ${m.sid} · ${LAYER_NAMES[m.layer]}`).join("; ") : "Ningún statement coincide";
      const over = result.test.expected === "Deny" && result.actual === "Allow";
      return `<article class="${pass ? "is-pass" : "is-fail"}" role="listitem" tabindex="0" data-test-index="${index}">
        <div><span>${pass ? "✓" : "!"}</span><small>${escapeHtml(result.test.action)}</small><strong>${escapeHtml(result.test.label)}</strong></div>
        <b class="is-${result.actual.toLowerCase()}">${result.actual}</b>
        <dl><div><dt>ESPERADO</dt><dd>${result.test.expected}</dd></div><div><dt>RAZÓN</dt><dd>${escapeHtml(result.evaluation.reason)}</dd></div><div><dt>MATCHED STATEMENTS</dt><dd>${escapeHtml(matched)}</dd></div>${result.evaluation.limitingLayer ? `<div><dt>CAPA LIMITANTE / MISSING ALLOW</dt><dd>${escapeHtml(LAYER_NAMES[result.evaluation.limitingLayer])}</dd></div>` : ""}${over ? '<div class="is-over"><dt>OVERPERMISSION</dt><dd>La policy permite una solicitud que debía quedar denegada.</dd></div>' : ""}</dl>
      </article>`;
    }).join("")}</div>`;
  }

  function previewMarkup(challenge) {
    if (!state.previewOpen) return "";
    return `<div class="iaml-modal" role="dialog" aria-modal="true" aria-labelledby="iaml-preview-title"><div><header><span><small>JSON POLICY PREVIEW</small><h2 id="iaml-preview-title">Documentos efectivos seleccionados</h2></span><button type="button" data-iaml-action="preview" aria-label="Cerrar preview">×</button></header><div class="iaml-json-tabs">${challenge.activeLayers.map((layer) => `<section><h3>${escapeHtml(LAYER_NAMES[layer])}</h3><pre>${escapeHtml(JSON.stringify(policyDocument(layer), null, 2))}</pre></section>`).join("")}</div><p>Vista educativa local. No envía ni aplica policies en AWS.</p></div></div>`;
  }

  function gameMarkup() {
    const challenge = currentChallenge();
    const stats = readStats();
    const risky = selectedCards().reduce((sum, item) => sum + item.cost, 0);
    const passed = state.results ? state.results.filter((result) => result.actual === result.test.expected).length : 0;
    return `<section class="iam-labyrinth-shell" aria-label="IAM Labyrinth">
      <header class="iaml-header"><div class="iaml-brand"><span aria-hidden="true">IAM</span><div><small>POLICY EVALUATION PUZZLE</small><h1>IAM Labyrinth <b>${escapeHtml(state.mode)}</b></h1></div></div><div class="iaml-head-stats"><span><b>${state.score || 0}</b><small>SCORE</small></span><span><b>${stats.stars}</b><small>★ TOTAL</small></span><span><b>${Math.min(stats.campaignProgress, CHALLENGES.length)}/${CHALLENGES.length}</b><small>CAMPAIGN</small></span></div><nav><button type="button" data-iaml-action="preview">{ } JSON</button><button type="button" data-iaml-action="modes">Modos</button><button type="button" data-iaml-action="exit">Salir</button></nav></header>
      <section class="iaml-brief"><div><span>CHALLENGE ${String(CHALLENGES.indexOf(challenge) + 1).padStart(2, "0")} · ${escapeHtml(challenge.domain)}</span><h2>${escapeHtml(challenge.title)}</h2><p>${escapeHtml(challenge.brief)}</p></div><div><span>DIFICULTAD</span><b>${"◆".repeat(challenge.difficulty)}</b><small>${challenge.tests.length} solicitudes</small></div></section>
      ${pathMarkup(challenge)}
      <div class="iaml-workspace">
        <main class="iaml-builder"><div class="iaml-section-head"><div><span>POLICY FRAGMENTS</span><h2>Construye la ruta efectiva</h2></div><span>${state.selected.size} seleccionados · riesgo ${risky}</span></div>
          <div class="iaml-layer-list">${challenge.activeLayers.map((layer) => `<section><header><span>${layer === "identity" ? "ID" : layer === "boundary" ? "PB" : layer === "scp" ? "OU" : layer === "trust" ? "TR" : "RP"}</span><div><small>EVALUATION LAYER</small><h3>${escapeHtml(LAYER_NAMES[layer])}</h3></div></header><div>${challenge.cards.filter((item) => item.layer === layer).map(cardMarkup).join("")}</div></section>`).join("")}</div>
          <div class="iaml-runbar"><div><span>SUITE STATUS</span><strong>${state.results ? `${passed}/${challenge.tests.length} correctas` : "Lista para evaluar"}</strong><small>Atajos: 1–9 alternan cards · Ctrl/⌘ + Enter ejecuta</small></div><button type="button" data-iaml-action="run">▶ Ejecutar ${challenge.tests.length} solicitudes</button></div>
        </main>
        <aside class="iaml-console" aria-label="Resultados de evaluación"><div class="iaml-section-head"><div><span>EVALUATION TRACE</span><h2>Request suite</h2></div><span>${state.attempts} runs</span></div>${resultsMarkup()}${state.results ? `<section class="iaml-lesson"><span>${state.completed ? "LAB CLEARED" : "EVIDENCE"}</span><h3>${state.completed ? `${state.earnedStars}★ · ${state.score} puntos` : "Revisa las capas marcadas"}</h3><p>${escapeHtml(challenge.lesson)}</p>${state.completed ? `<button type="button" data-iaml-action="next">${state.mode === "daily" ? "Volver a modos" : "Siguiente desafío →"}</button>` : ""}</section>` : ""}</aside>
      </div>
      <footer class="iaml-footer"><span><i></i> Explicit Deny prevalece</span><span><i></i> Boundary y SCP limitan, no conceden</span><p>Simulador educativo simplificado · sin conexión a AWS</p></footer>
      <p class="iaml-sr-only" id="iaml-live" aria-live="assertive"></p>${previewMarkup(challenge)}
    </section>`;
  }

  function shellMarkup() {
    if (!state || state.screen === "modes") return `<section class="iam-labyrinth-shell is-picker">${modeScreen()}<p class="iaml-sr-only" id="iaml-live" aria-live="assertive"></p></section>`;
    if (state.screen === "challenges") return `<section class="iam-labyrinth-shell is-picker">${challengePicker(state.pickerMode)}<p class="iaml-sr-only" id="iaml-live" aria-live="assertive"></p></section>`;
    return gameMarkup();
  }

  function render() {
    if (!host) return;
    host.innerHTML = shellMarkup();
  }

  function announce(message) {
    if (liveTimer) window.clearTimeout(liveTimer);
    liveTimer = window.setTimeout(() => {
      const live = host && host.querySelector("#iaml-live");
      if (live) live.textContent = message;
    }, 20);
  }

  function scoreRun(results) {
    const challenge = currentChallenge();
    const correct = results.filter((item) => item.actual === item.test.expected).length;
    const falseAllows = results.filter((item) => item.test.expected === "Deny" && item.actual === "Allow").length;
    const risk = selectedCards().reduce((sum, item) => sum + item.cost, 0);
    const extraFragments = selectedCards().filter((item) => !challenge.correct.includes(item.id)).length;
    return Math.max(0, correct * 250 + (correct === results.length ? 500 : 0) - falseAllows * 300 - risk * 45 - extraFragments * 80 - Math.max(0, state.attempts - 1) * 35);
  }

  function commitWin() {
    if (state.statsCommitted) return;
    const stats = readStats();
    const challenge = currentChallenge();
    stats.wins += 1; stats.totalScore += state.score; stats.bestScore = Math.max(stats.bestScore, state.score); stats.stars += state.earnedStars;
    const previous = stats.solved[challenge.id];
    if (!previous || state.score > previous.score) stats.solved[challenge.id] = { score: state.score, stars: state.earnedStars };
    if (state.mode === "campaign") stats.campaignProgress = Math.max(stats.campaignProgress, CHALLENGES.indexOf(challenge) + 1);
    if (state.mode === "daily") stats.daily[state.today] = { id: challenge.id, score: state.score, stars: state.earnedStars };
    stats.lastPlayed = state.today; saveStats(stats); state.statsCommitted = true;
  }

  function runSuite() {
    if (!state || state.screen !== "game") return;
    if (!state.playedCommitted) {
      const stats = readStats();
      stats.played += 1; stats.lastPlayed = state.today; saveStats(stats);
      state.playedCommitted = true;
    }
    state.attempts += 1;
    const challenge = currentChallenge();
    const cards = selectedCards();
    state.results = challenge.tests.map((test) => ({ test, evaluation: evaluate(test, cards, challenge), get actual() { return this.evaluation.decision; } }));
    const allPass = state.results.every((item) => item.actual === item.test.expected);
    state.score = scoreRun(state.results);
    state.completed = allPass;
    if (allPass) {
      const risk = cards.reduce((sum, item) => sum + item.cost, 0);
      state.earnedStars = risk === 0 && state.attempts === 1 ? 3 : risk <= 2 && state.attempts <= 2 ? 2 : 1;
      commitWin();
    }
    render();
    announce(allPass ? `Desafío resuelto con ${state.earnedStars} estrellas y ${state.score} puntos.` : `${state.results.filter((item) => item.actual === item.test.expected).length} de ${challenge.tests.length} solicitudes correctas.`);
  }

  function toggleCard(id) {
    const challenge = currentChallenge();
    if (!challenge || !challenge.cards.some((item) => item.id === id)) return;
    if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
    state.results = null; state.completed = false; state.score = 0; state.earnedStars = 0;
    render(); announce(`${state.selected.has(id) ? "Seleccionado" : "Retirado"}: ${challenge.cards.find((item) => item.id === id).title}`);
  }

  function openMode(mode) {
    if (mode === "daily") { newGame("daily", dailyChallenge(utcDateKey(new Date()))); render(); return; }
    state = { screen: "challenges", pickerMode: mode }; render();
  }

  function nextChallenge() {
    if (state.mode === "daily") { state = { screen: "modes" }; render(); return; }
    const index = CHALLENGES.indexOf(currentChallenge());
    if (index >= CHALLENGES.length - 1) { state = { screen: "challenges", pickerMode: state.mode }; render(); return; }
    newGame(state.mode, CHALLENGES[index + 1]); render();
  }

  function onClick(event) {
    const cardButton = event.target.closest("[data-iaml-card]");
    if (cardButton && host.contains(cardButton)) { toggleCard(cardButton.dataset.iamlCard); return; }
    const modeButton = event.target.closest("[data-iaml-mode]");
    if (modeButton && host.contains(modeButton)) { openMode(modeButton.dataset.iamlMode); return; }
    const challengeButton = event.target.closest("[data-iaml-challenge]");
    if (challengeButton && host.contains(challengeButton)) { newGame(challengeButton.dataset.mode || "sandbox", CHALLENGES.find((item) => item.id === challengeButton.dataset.iamlChallenge) || CHALLENGES[0]); render(); return; }
    const action = event.target.closest("[data-iaml-action]");
    if (!action || !host.contains(action)) return;
    if (action.dataset.iamlAction === "run") runSuite();
    else if (action.dataset.iamlAction === "preview") {
      const opening = !state.previewOpen;
      state.previewOpen = opening; render();
      const focusTarget = host.querySelector(opening ? ".iaml-modal button" : '[data-iaml-action="preview"]');
      if (focusTarget) focusTarget.focus();
    }
    else if (action.dataset.iamlAction === "next") nextChallenge();
    else if (action.dataset.iamlAction === "modes") { state = { screen: "modes" }; render(); }
    else if (action.dataset.iamlAction === "exit" && typeof exitCallback === "function") exitCallback();
  }

  function onChange() { /* Reserved for native form controls in future challenges. */ }

  function onKeydown(event) {
    if (!host || !state) return;
    if (event.key === "Escape" && state.previewOpen) {
      state.previewOpen = false; render();
      const previewButton = host.querySelector('[data-iaml-action="preview"]');
      if (previewButton) previewButton.focus();
      return;
    }
    if (state.screen !== "game" || (event.target && event.target.closest && event.target.closest("input, textarea, select"))) return;
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); runSuite(); return; }
    if (/^[1-9]$/.test(event.key)) {
      const item = currentChallenge().cards[Number(event.key) - 1];
      if (item) { event.preventDefault(); toggleCard(item.id); }
    }
  }

  function mount(element, onExit) {
    destroy();
    if (!element || element.nodeType !== 1) throw new Error("IamLabyrinth.mount requiere un elemento DOM válido.");
    host = element; exitCallback = typeof onExit === "function" ? onExit : null; ensureStyles();
    state = { screen: "modes" };
    clickHandler = onClick; changeHandler = onChange; keyHandler = onKeydown;
    host.addEventListener("click", clickHandler); host.addEventListener("change", changeHandler); document.addEventListener("keydown", keyHandler);
    render();
  }

  function destroy() {
    if (liveTimer) { window.clearTimeout(liveTimer); liveTimer = null; }
    if (host && clickHandler) host.removeEventListener("click", clickHandler);
    if (host && changeHandler) host.removeEventListener("change", changeHandler);
    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    if (host) host.innerHTML = "";
    if (ownedStyle && ownedStyle.parentNode) ownedStyle.parentNode.removeChild(ownedStyle);
    host = null; exitCallback = null; state = null; ownedStyle = null; clickHandler = null; changeHandler = null; keyHandler = null;
  }

  window.IamLabyrinth = { mount, destroy, getStats: readStats };
}());

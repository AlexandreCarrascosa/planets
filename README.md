# Solaris 3D

**Buracos negros configuráveis:** seis massas até **10 bilhões de sóis**, posicionamento manual e encontro para acompanhar atração, marés e captura. Acesse **Laboratório → Criar**. [Funcionamento e limites físicos](docs/BURACOS_NEGROS_MASSIVOS.md).

**Atualização científica de 02/11/2026:** novos cenários de N corpos em unidades astronômicas, estrelas binárias, correção relativística de Mercúrio, buraco negro com massa solar e evolução do Sol até gigante vermelha/anã branca. Rupturas usam material granular com autoatração. Leia o [levantamento com referências, implementações e limites](docs/PESQUISA_E_IMPLEMENTACAO_CIENTIFICA.md). Os encontros destrutivos continuam um modelo reduzido; não são SPH ou relatividade numérica.

Um simulador interativo do Sistema Solar, em português, com exploração e laboratório de física. Criado na pasta `planets`, com Three.js e Vite. A aplicação é inteiramente client-side; o servidor local apenas entrega os arquivos.

**Acesse online:** [Solaris 3D](https://alexandrecarrascosa.github.io/planets/)

**Melhorias locais de 15/10/2026:** colisões por regime, fragmentos com massa/momento preservados, nuvens dinâmicas na Terra, resposta térmica e novos cenários. Consulte [o que foi implementado e seus limites](docs/MELHORIAS_IMPLEMENTADAS.md) e o [plano completo](docs/PLANO_DE_EVOLUCAO.md). A versão online só recebe essas mudanças quando forem enviadas ao repositório.

**Revisão das marés:** aproximação com deformação radial limitada, ruptura em fragmentos e captura gradual; novo cenário **Marés · buraco negro** e botão **+1d**. Veja a [sequência, testes e limites](docs/CORRECAO_MARES.md).

**Revisão dos impactos:** contato com os dois corpos visíveis, ruptura em sólidos que preservam a textura e fusão com incorporação gradual do material. Veja a [correção e seus limites](docs/CORRECAO_COLISOES.md).

## Publicação no GitHub Pages

O repositório usa `.github/workflows/deploy.yml` para testar, compilar e publicar automaticamente cada atualização enviada à branch `main`. O site é servido pelo GitHub Pages, sem depender do computador local.

Para reutilizar em outra conta, ative **Settings → Pages → Source → GitHub Actions**. O Vite gera caminhos relativos, inclusive para as texturas, permitindo servir o aplicativo em uma subpasta ou domínio próprio. O workflow publica somente `dist/`; as dependências locais ficam fora do Git.

## Executar

Requer Node.js 22.12+ (ou 20.19+) e navegador moderno com WebGL 2 e aceleração de hardware.

```powershell
cd C:\Github\Planeta\planets
npm install
npm run dev
```

Abra **http://127.0.0.1:5173**. As texturas estão incluídas em `public/assets/textures`; depois de instalar as dependências, não é necessária conexão para a simulação. As fontes Google são opcionais e têm fallback local. Não abra `index.html` diretamente via `file://`, pois os módulos precisam do servidor.

```powershell
npm test          # Testes de física e relógio
npm run build    # Gera a aplicação em dist/
npm run preview  # Serve a versão de produção
```

## Exploração

- Oito planetas, Sol, Lua, Fobos, Deimos, Io, Europa, Ganimedes, Calisto e Titã.
- Texturas locais 2K, nuvens independentes e luzes noturnas terrestres, atmosfera de borda, anéis de Saturno, sombras sobre anéis e luas, campo de estrelas e cinturão de asteroides instanciado.
- Órbitas keplerianas com excentricidade e inclinação; rotações com períodos de referência, incluindo Vênus e Urano retrógrados.
- Clique em um planeta, nome, lista ou ponto do mapa para selecionar e aproximar suavemente a câmera.
- Escala didática facilita a observação. Escala real usa a mesma unidade para raios e distâncias; os planetas tornam-se muito pequenos. Selecione um nome para aproximar.
- Controle de tempo entre pausa e 1.000 anos por segundo. A data inicial é 01/01/2026; **as posições iniciais são uma composição visual, não efemérides para essa data**.

| Controle                   | Ação                                                |
| -------------------------- | --------------------------------------------------- |
| Arrastar no espaço         | Orbitar câmera                                      |
| Scroll / gesto de pinça    | Aproximar ou afastar                                |
| Botão direito / dois dedos | Mover câmera lateralmente                           |
| Espaço                     | Pausar / continuar                                  |
| F                          | Focar corpo selecionado                             |
| H                          | Visão geral                                         |
| Ícone de navegação         | Ativar voo livre                                    |
| WASD no voo livre          | Deslocar                                            |
| Q / E                      | Descer / subir                                      |
| Shift                      | Acelerar voo                                        |
| Arrastar no voo livre      | Olhar ao redor                                      |
| Esc                        | Cancelar ferramenta de criação                      |
| Ícone de câmera            | Salvar PNG da cena                                  |
| Ícone de reinício          | Restaurar sistema, massa, gravidade, tempo e corpos |

## Laboratório

1. Abra **Laboratório → Criar**.
2. Escolha meteoro, cometa, buraco negro ou estrela.
3. Clique no espaço para criar no plano orbital do corpo selecionado. Arraste antes de soltar para definir a velocidade na direção da seta. A simulação pausa durante o gesto e retoma seu estado anterior.
4. **Física** permite ligar gravidade mútua, desativar colisões, variar gravidade e massa solar, parar ou inverter rotação, inverter órbita e arrastar/arremessar um planeta.
5. **Visual** controla qualidade, brilho, exposição e asteroides. Órbitas, nomes e voo livre também têm botões na cena.

**Cenários:** chuva de meteoros, Terra × Marte (os dois corpos são posicionados em uma região isolada para uma colisão reproduzível) e sistema binário.

Pequenos impactos deixam marcas curvas na superfície e partículas; planetas gasosos não recebem crateras de solo. Colisões maiores podem fundir corpos, preservar dois remanescentes em encontros rasantes ou causar ruptura. A fragmentação preserva massa/momento linear e limita a energia de ejeção. Cometas têm rastro. Buracos negros têm disco alimentado após captura, distorção de tela e deformação por gradiente de maré aproximado. A massa capturada atualiza a gravidade e o raio físico; o horizonte desenhado continua ampliado.

Na Terra, transporte de umidade, evaporação, condensação e precipitação modificam um campo de nuvens; uma textura fornece os detalhes visuais. O controle **Luminosidade solar** altera fluxo recebido e temperatura estimada. Os cenários **Terra em resfriamento** e **Terra sob calor extremo** permitem observar gelo e resposta das nuvens com o tempo. A circulação é prescrita e a superfície ainda não tem hidrologia ou meteorologia local completa.

O motor usa gravitação newtoniana suavizada e integração kick-drift-kick. A detecção contínua de esferas evita que projéteis rápidos atravessem os planetas. Uma vez solto da órbita kepleriana, um planeta permanece livre até o reinício. Desligar gravidade mútua mantém atração solar e de estrelas/buracos negros adicionais. A mudança entre escalas após experiências restaura o sistema, para não misturar unidades.

## Qualidade e limites

Configuração equilibrada solicitada: texturas 2K, geometrias com três níveis de detalhe, 1.600 asteroides e pixel ratio máximo de 1,5. Leve usa 600 asteroides e resolução 1×; Ultra usa 3.200 e até 2×. Até 96 corpos físicos e 1.400 partículas visuais. O laboratório limita o tempo a 100 dias/s para estabilidade; exploração kepleriana permite até 1.000 anos/s.

Este é um **sandbox educacional**, não uma ferramenta de previsão astronômica. As distâncias/tamanhos do modo didático e as unidades dinâmicas são comprimidos; o motor não conserva órbitas NASA quando muda para física livre. Fragmentação, crateras e espaguetificação são aproximações visuais, sem deformação geológica ou hidrodinâmica. A lente é uma distorção em espaço de tela aplicada ao buraco negro de maior tamanho aparente; não resolve relatividade geral. Não são usados texturas 4K/8K, ray tracing, motion blur ou profundidade de campo. O ganho de fluidez foi priorizado conforme a preferência equilibrada.

O programa solicita WebGL 2. Falhas de carregamento de texturas usam materiais alternativos. Uma perda de contexto da GPU mostra instruções de recuperação. O FPS exibido é medido na sessão, não uma garantia de desempenho em outros dispositivos.

## Estrutura

```text
index.html                Interface acessível em português
css/                      Tema, painéis, animações e responsividade
js/core/                  Cena, carregamento de assets, relógio
js/bodies/                Sol, planetas, luas, asteroides e buracos negros
js/physics/               Kepler, gravitação e colisões contínuas
js/effects/               Atmosferas, bloom, lente, partículas e rastros
js/interaction/           Câmera, seleção, arrastar e lançar
js/ui/                    Controles, informações, minimapa e eventos
js/data/                  Dados de referência e cenários
public/assets/textures/   Texturas incluídas e servidas localmente
scripts/                  Download reproduzível das texturas públicas
tests/                    Testes numéricos independentes do navegador
```

## Fontes e créditos

- Dados físicos: [NASA/NSSDCA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/). Valores médios/arredondados; temperaturas de gigantes correspondem às referências atmosféricas, não a superfícies sólidas.
- Texturas: [Solar System Scope / INOVE](https://www.solarsystemscope.com/textures/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). As texturas são baseadas em imagens e dados NASA, com ajustes artísticos feitos pelo fornecedor. Redistribuídas sem alteração; efeitos de material são aplicados em tempo real.
- Renderização: [Three.js](https://threejs.org/), licença MIT.
- Fontes: DM Sans e Space Grotesk, distribuídas por Google Fonts sob licenças abertas.

O Three.js foi instalado localmente e fixado no arquivo de dependências, em vez de depender de CDN em tempo de execução. Isso torna a aplicação reproduzível e permite uso offline após a instalação.

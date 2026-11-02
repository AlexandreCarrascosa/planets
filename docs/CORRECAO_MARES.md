# Aproximação, distorção e captura pelo buraco negro

## O que mudou

O planeta deixa de ser escalado e girado pelo grupo principal da cena. A deformação atua em um grupo próprio da superfície, atmosfera e nuvens; rotação, inclinação e posições das luas mantêm seus referenciais. Isso evita deformar todo o sistema do planeta como uma peça rígida.

O modelo reduzido calcula a carga de maré pelo gradiente `2μ/r³`, pelo tamanho do corpo, por sua autogravidade e por um parâmetro aproximado de coesão do material. A resposta cresce suavemente com o tempo simulado. Enquanto o corpo está íntegro, a transformação tem um eixo alongado na direção do atrator e dois eixos transversais igualmente comprimidos. A transformação preserva volume e limita o alongamento do corpo íntegro a 1,65×; forças maiores provocam ruptura, em vez de manter um elipsoide cada vez mais achatado.

Quando o dano acumulado atinge o limite, o corpo é substituído por até 128 fragmentos ponderados, com massas e tamanhos diferentes. A criação preserva massa, centro de massa e momento linear translacional, sem impulso explosivo aleatório. Os detritos seguem a mesma gravidade e o mesmo tempo do laboratório: a diferença de aceleração entre eles produz a corrente alongada. O buraco negro recebe apenas a massa e o momento dos fragmentos que cruzam o horizonte representado. Material que continua fora dele permanece na simulação.

O disco é alimentado progressivamente pelas capturas. A explosão radial da antiga absorção foi removida. Os fragmentos rochosos têm formas facetadas e cores minerais, em vez de pequenas esferas com o mapa do planeta repetido.

A lente em tela agora verifica a profundidade dos objetos e preserva os que estão à frente do buraco negro. Sua intensidade foi reduzida e o alinhamento é atualizado depois da câmera, evitando que a distorção ótica artificial acentue o achatamento do corpo.

## Como conferir

1. Abrir **Laboratório → Criar → Marés · buraco negro**. O cenário reinicia o sistema e cria um encontro reproduzível a 1 dia/s.
2. Usar **+1d** para pausar e avançar um dia por vez. Por volta do 10º dia do cenário, o planeta está alongado; perto do 13º dia ocorre a ruptura; nos dias seguintes o material se estende e cruza o horizonte. Os números são marcos deste cenário didático, não previsões de um evento real.
3. Ao romper o corpo acompanhado, a câmera enquadra o encontro e passa a seleção ao buraco negro. O painel **Física** mostra os fragmentos ainda ativos ou o término da captura.
4. Reduzir a velocidade para **1 hora/s** para observar a passagem dos últimos fragmentos. Pausar congela deformação, dano e trajetórias; **+1d** permite inspecioná-los sem depender do FPS.

## Verificação e limites

25 testes passaram, incluindo o gradiente com a distância, limite e continuidade da deformação, preservação de volume, isolamento das luas, conservação na ruptura, detecção contínua do horizonte, balanço entre massa capturada/restante e comportamento de pausa/avanço. A compilação de produção e a conferência visual no navegador também foram realizadas.

É uma aproximação newtoniana no laboratório de escalas comprimidas. A coesão ainda não é calibrada em unidades físicas; não são resolvidos hidrodinâmica, autogravidade dos detritos, spin interno completo, geodésicas relativísticas ou o atraso ótico de um observador distante. O horizonte visível continua exagerado. A sequência qualitativa de alongamento, ruptura, corrente e acreção usa como referência a [explicação da NASA sobre ruptura de maré](https://science.nasa.gov/universe/what-happens-when-something-gets-too-close-to-a-black-hole/).

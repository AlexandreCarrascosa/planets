# Continuidade dos impactos entre planetas

Atualização local de 15/10/2026.

## Problema corrigido

A resolução anterior executava `destroy(smaller)` no primeiro contato. Na fusão, aumentava imediatamente a massa e o tamanho do outro planeta. Na ruptura, criava esferas de detritos já afastadas dos corpos. O material do planeta removido não tinha uma transição visual até seu destino.

## Nova sequência

1. **Contato:** ambos os corpos continuam visíveis. Uma compressão suave, de no máximo 10% no eixo do impacto, preserva o volume e mantém os dois eixos transversais iguais. Essa fase usa o relógio do laboratório e pode ser pausada ou avançada com **+1d**.
2. **Ruptura:** cortes em planos subdividem o volume de cada corpo em sólidos convexos fechados. Os triângulos externos mantêm as coordenadas da textura original. Os cortes revelam um interior com granulação e veios incandescentes, cujo brilho diminui com o tempo.
3. **Substituição contínua:** os fragmentos começam exatamente nas regiões que ocupavam nos dois planetas comprimidos. Todas as geometrias são preparadas antes de substituir as superfícies originais. Não há deslocamento artificial de uma fila de esferas para longe do contato.
4. **Movimento dos remanescentes:** cada sólido recebe massa, gravidade, volume equivalente e velocidade. O fluxo depende do movimento incidente e do eixo do contato. A correção ponderada preserva o momento linear; 30% da energia cinética relativa fica disponível para a translação dos fragmentos, conforme o orçamento aproximado já adotado pelo laboratório.
5. **Fusão:** o corpo maior permanece visível, enquanto 32 porções fechadas representam o material do menor. Elas avançam de forma progressiva para o remanescente. Uma porção só é retirada depois que sua esfera envolvente está inteiramente contida no raio interno conservador do remanescente. Sua massa e seu volume são incorporados nesse instante. O corpo de origem só é destruído depois que não resta material em transporte.
6. **Continuidade física:** durante a transferência, o corpo de origem representa gravitacionalmente apenas o material ainda não incorporado. O balanço de massa, gravidade, volume e movimento é atualizado a cada etapa; não se cria massa duplicada para desenhar os pedaços.
7. **Reprodução:** os cenários Terra × Marte, fusão e impacto rasante restauram os corpos antes de cada execução. Os cenários ficam acima do plano orbital, mantendo a Terra perto de seu fluxo solar de referência. A câmera acompanha o encontro e permite examinar as fases com **+1d**.
8. **Remanescente aquecido:** fusões de planetas rochosos estimam a energia liberada pela mudança da energia de ligação gravitacional de esferas uniformes e pelo movimento relativo. A estimativa usa massas/raios em SI e normaliza a velocidade pela razão com a velocidade de escape. O reservatório térmico aquece a superfície, modifica a aparência dos oceanos/solo e reduz as nuvens de água visíveis quando há fusão superficial. O resfriamento radiativo usa a área do remanescente e uma capacidade térmica média aproximada de 1.000 J/(kg·K). A Terra não volta ao aspecto intacto após alguns dias.

Os fragmentos de impacto não são apagados por um prazo visual. O limite de 96 corpos continua valendo: havendo pouca capacidade, a ruptura produz menos sólidos e reutiliza os dois objetos originais, sem descartar massa. Partículas de brilho e poeira são efeitos visuais separados dos sólidos com massa; agora também seguem o tempo do laboratório. A onda atmosférica tem transparência concentrada na borda, evitando a aparência de uma esfera luminosa opaca no contato.

Um planeta pequeno diante de um gigante também não usa mais o atalho reservado a meteoros de massa muito pequena. Colisões rasantes continuam preservando dois corpos com impulso dissipativo; pequenos projéteis ainda usam o modelo de cratera local.

## Verificação

- 34 testes automatizados passaram, incluindo conservação de massa, centro e momento linear em ambiente isolado, orçamento de energia dos fragmentos, primeira fase com ambos os corpos visíveis, bloqueio de contatos repetidos, pausa, avanço de um dia, limpeza após reinício, limite de corpos cheio e aquecimento/resfriamento do remanescente.
- Compilação de produção concluída. Permanece o aviso de tamanho do pacote JavaScript, sem impedir a compilação.
- Conferência no navegador dos cenários de ruptura e fusão, observando a transição em passos de um dia.
- Registros: [contato](impacto-contato.jpg), [fragmentos](impacto-fragmentos.jpg) e [transferência na fusão](impacto-fusao.jpg).

## Limites do modelo

Esta correção resolve a continuidade entre os corpos originais, o material transportado e os remanescentes. A fratura por planos e os caminhos dissipativos da fusão são aproximações visuais e físicas reduzidas, com duração ajustada para observação na escala didática. Não são uma solução de hidrodinâmica planetária.

Não estão resolvidos pressão, equação de estado, vaporização, diferenciação núcleo/manto, conservação completa de momento angular, autoacréscimo de todos os detritos ou envelopes gasosos fluidos. Os fragmentos usam esferas envolventes para detecção e colisões entre detritos continuam desativadas. O aquecimento supõe mistura uniforme e ignora calor latente, escape atmosférico e o efeito de uma atmosfera de vapor sobre o resfriamento. O campo de nuvens continua fora de sua faixa de validade nesse regime extremo. Temperaturas, tempo de contato e limites de energia são estimativas ilustrativas e não uma previsão quantitativa de um evento real.

A evolução para unidades físicas consistentes e para um modelo de material/fluido continua no [plano de evolução](PLANO_DE_EVOLUCAO.md).

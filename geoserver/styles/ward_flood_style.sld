<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
    xmlns="http://www.opengis.net/sld"
    xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>ward_flood_style</Name>
    <UserStyle>
      <Name>ward_flood_style</Name>
      <Title>Wards by share of High flood risk</Title>
      <Abstract>ward_flood_summary: share of each ward in the High flood class, five steps cream to navy.</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <Title>Under 5%</Title>
          <ogc:Filter>
            <ogc:And>
                <ogc:PropertyIsGreaterThanOrEqualTo><ogc:PropertyName>high_share_pct</ogc:PropertyName><ogc:Literal>0</ogc:Literal></ogc:PropertyIsGreaterThanOrEqualTo>
                <ogc:PropertyIsLessThan><ogc:PropertyName>high_share_pct</ogc:PropertyName><ogc:Literal>5</ogc:Literal></ogc:PropertyIsLessThan>
              </ogc:And>
          </ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#fbf6d9</CssParameter><CssParameter name="fill-opacity">0.8</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#ffffff</CssParameter><CssParameter name="stroke-width">0.6</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Title>5-10%</Title>
          <ogc:Filter>
            <ogc:And>
                <ogc:PropertyIsGreaterThanOrEqualTo><ogc:PropertyName>high_share_pct</ogc:PropertyName><ogc:Literal>5</ogc:Literal></ogc:PropertyIsGreaterThanOrEqualTo>
                <ogc:PropertyIsLessThan><ogc:PropertyName>high_share_pct</ogc:PropertyName><ogc:Literal>10</ogc:Literal></ogc:PropertyIsLessThan>
              </ogc:And>
          </ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#c4e6b8</CssParameter><CssParameter name="fill-opacity">0.8</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#ffffff</CssParameter><CssParameter name="stroke-width">0.6</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Title>10-20%</Title>
          <ogc:Filter>
            <ogc:And>
                <ogc:PropertyIsGreaterThanOrEqualTo><ogc:PropertyName>high_share_pct</ogc:PropertyName><ogc:Literal>10</ogc:Literal></ogc:PropertyIsGreaterThanOrEqualTo>
                <ogc:PropertyIsLessThan><ogc:PropertyName>high_share_pct</ogc:PropertyName><ogc:Literal>20</ogc:Literal></ogc:PropertyIsLessThan>
              </ogc:And>
          </ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#5fbcc0</CssParameter><CssParameter name="fill-opacity">0.8</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#ffffff</CssParameter><CssParameter name="stroke-width">0.6</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Title>20-35%</Title>
          <ogc:Filter>
            <ogc:And>
                <ogc:PropertyIsGreaterThanOrEqualTo><ogc:PropertyName>high_share_pct</ogc:PropertyName><ogc:Literal>20</ogc:Literal></ogc:PropertyIsGreaterThanOrEqualTo>
                <ogc:PropertyIsLessThan><ogc:PropertyName>high_share_pct</ogc:PropertyName><ogc:Literal>35</ogc:Literal></ogc:PropertyIsLessThan>
              </ogc:And>
          </ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#2b7bb3</CssParameter><CssParameter name="fill-opacity">0.8</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#ffffff</CssParameter><CssParameter name="stroke-width">0.6</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Title>35% or more</Title>
          <ogc:Filter>
            <ogc:PropertyIsGreaterThanOrEqualTo><ogc:PropertyName>high_share_pct</ogc:PropertyName><ogc:Literal>35</ogc:Literal></ogc:PropertyIsGreaterThanOrEqualTo>
          </ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#16306b</CssParameter><CssParameter name="fill-opacity">0.8</CssParameter></Fill>
            <Stroke><CssParameter name="stroke">#ffffff</CssParameter><CssParameter name="stroke-width">0.6</CssParameter></Stroke>
          </PolygonSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>

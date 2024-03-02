import { ActionPanel, Action, List } from "@raycast/api";
import { useFetch, Response } from "@raycast/utils";
import { useState } from "react";
import { URLSearchParams } from "node:url";
import * as cheerio from 'cheerio'

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const execute = searchText.length > 0;
  const requests = [
    useFetch(
      "https://japonesbasico.com/furigana/procesa.php",
      {
        method: 'POST',
        body: JSON.stringify({
          conversion: 'romaji',
          japaneseText: searchText,
          lang: 'en',
        }),
        execute,
        parseResponse: parseFetchResponseForRomaji,
      },
    ),
    useFetch(
      "http://127.0.0.1:11434/api/generate",
      {
        method: 'POST',
        body: JSON.stringify({
          model: 'gemma:7b',
          prompt: "You are a professional translator. Please translate the following Japanese text into English and Chinese. Start right away with the translation without any explanation.\n\n" + searchText,
        }),
        execute,
        parseResponse: parseFetchResponseForEnglish,
      },
    ),
  ];
  return (
    <List
      isLoading={requests.some(_ => _.isLoading)}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Japanese text here"
      throttle
      isShowingDetail
    >
      {...requests.map(({ data, isLoading }) => {
        return (<List.Item
          title={data?.title || '...'}
          detail={
            <List.Item.Detail
              markdown={data?.markdown}
            />
          }
          />);
      })}
    </List>
  );
}

interface SearchResult {
  title: string,
  markdown: string;
}

async function parseFetchResponseForRomaji(response: Response) {
  /*
    <h3>Results</h3>
    <center>
      <button class="boton" id="hideButton" onclick="hideFirstColumn()">
        Show the rōmaji only
      </button>
    </center>
    <table border=1>
      <tr>
        <td>The <ruby>cat<rt>nekko</rt></ruby>meows.</td>
        <td>The nekko meows.</td>
      </tr>
    </table>
   */
  const doc = cheerio.load(await response.text());
  const tds = doc('tr').children();
  let annotaionHtml = cheerio.load(tds[0]).html();
  // remove '<td>' and '</td>'.
  annotaionHtml = annotaionHtml.substring(4, annotaionHtml.length - 5);
  // annotaionHtml = '<div>' + annotaionHtml + '</div>';
  annotaionHtml = annotaionHtml.replace(/<ruby>(.+?)<rt>(.+?)<\/rt><\/ruby>/g, '**$1** ($2) ');
  const pronunciationText = cheerio.load(tds[1]).text();
  return {
    title: 'Romaji',
    markdown: annotaionHtml + '\n\n' + pronunciationText,
  } as SearchResult;
}

async function parseFetchResponseForEnglish(response: Response) {
  const text = (await response.text());
  const output = text.split('\n')
    .filter(row => row.length > 0)
    .map(row => JSON.parse(row).response)
    .join('')
    .split('\n')
    .filter((row) => {
      row = row.trim();
      if (row.length == 0) {
        return false;
      } if (row.startsWith('Sure')) {
        return false;
      } else if (row.indexOf('translated') >= 0) {
        return false;
      } else {
        return true;
      }
    })
    .map(row => {
      if (row.startsWith('"') && row.endsWith('"')) {
        return row.substring(1, row.length - 1);
      } else {
        return row;
      }
    })
    .join('\n')
    .trim();
  return {
    title: 'English',
    markdown: output,
  } as SearchResult;
}

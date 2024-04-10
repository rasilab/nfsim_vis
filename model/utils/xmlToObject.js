export function xmlToObject(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");


  function traverseNode(node, isListOfOperations = false) {
    let obj = {};
    let childrenArray = []; // Used only for ListOfOperations

    // Process the current node's children
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === 1) { // Element nodes
        let childObj = {};

        if (child.parentNode.nodeName === 'ListOfOperations') {
          childObj['type'] = child.nodeName;
        }


        // Exclude the 'id' attribute from being stored, but use it as a key if present
        Array.from(child.attributes).forEach(attr => {
          if (attr.nodeName !== 'id') {
            childObj[attr.nodeName] = attr.nodeValue;
          }
        });

        const childContent = traverseNode(child, child.nodeName === 'ListOfOperations');
        // Merge child node content if any
        if (Object.keys(childContent).length > 0) {
          childObj = { ...childObj, ...childContent };
        }

        if (isListOfOperations) {
          // Directly push to childrenArray if under ListOfOperations
          childrenArray.push(childObj);
        } else {
          let keyName = child.nodeName;
          // If the child has an id, use it as the key name instead
          if (child.attributes.id) {
            keyName = child.attributes.id.value;
          } else {
            // Normalize key name by removing 'ListOf'
            keyName = keyName.replace('ListOf', '');
          }

          // Handling multiple children with the same name or id
          if (obj.hasOwnProperty(keyName)) {
            // Convert to array if not already
            if (!Array.isArray(obj[keyName])) {
              obj[keyName] = [obj[keyName]];
            }
            obj[keyName].push(childObj);
          } else {
            obj[keyName] = childObj;
          }
        }
      } else if (child.nodeType === 3 && child.nodeValue.trim() !== '') { // Text nodes
        // Assume that text content is direct and does not mix with elements
        obj['_text'] = child.nodeValue.trim();
      }
    });

    return isListOfOperations ? childrenArray : obj;
  }


  let root = xmlDoc.getElementsByTagNameNS("http://www.sbml.org/sbml/level3", "model")[0];
  return traverseNode(root);
}